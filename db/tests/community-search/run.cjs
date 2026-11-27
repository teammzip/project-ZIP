const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { createHash, randomBytes } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const root = path.resolve(__dirname, '../../..');
const fixturePath = process.argv[2] ?? path.join(__dirname, 'fixture-v1.json');
const fixtureText = fs.readFileSync(fixturePath, 'utf8').replaceAll('\r\n', '\n');
const fixture = JSON.parse(fixtureText);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const regionIds = { home: 100002, neighbor: 100003, other: 100004 };
const regionsByScope = { here: ['home'], near: ['home', 'neighbor'], all: Object.keys(regionIds) };
const posts = new Map(fixture.posts.map(row => {
    const post = Object.fromEntries(fixture.postFields.map((field, index) => [field, row[index]]));
    return [post.id, post];
}));
const sorts = ['relevance', 'latest'];
const processes = [];
const rootPassword = randomBytes(24).toString('hex');
const appPassword = randomBytes(24).toString('hex');
const loginPassword = `Aa1!${randomBytes(6).toString('hex')}`;
const mysqlHome = process.env.ZIP_SEARCH_MYSQL_HOME ?? 'C:/Program Files/MySQL/MySQL Server 9.6';
const java = path.join(process.env.JAVA_HOME ?? '', 'bin/java.exe');
const jar = path.resolve(process.env.ZIP_SEARCH_JAR ?? path.join(root, 'backend/build/libs/backend-0.0.1-SNAPSHOT.jar'));

function execute(file, args, options = {}) {
    const result = spawnSync(file, args, { windowsHide: true, encoding: 'utf8', timeout: 90000, ...options });
    const error = (result.stderr || result.error?.message || '').trim();
    const safeError = [rootPassword, appPassword, loginPassword].reduce((message, value) => message.replaceAll(value, '[redacted]'), error);
    assert.equal(result.status, 0, `${path.basename(file)}: ${safeError}`);
    return result.stdout.trim();
}

function launch(work, label, file, args) {
    const fd = fs.openSync(path.join(work, `${label}.log`), 'w');
    const child = spawn(file, args, { cwd: work, windowsHide: true, stdio: ['ignore', fd, fd] });
    fs.closeSync(fd);
    child.on('error', error => console.error(label, error.message));
    processes.push(child);
    return child;
}

async function freePort() {
    const server = net.createServer();
    await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    return port;
}

async function waitFor(label, child, check) {
    let error;
    for (let attempt = 0; attempt < 120 && child.exitCode === null; attempt++) {
        try { return await check(); } catch (failure) { error = failure; }
        await delay(500);
    }
    throw new Error(`${label} failed to start: ${error?.message ?? child.exitCode}`);
}

const sqlString = value => `'${value.replaceAll("'", "''")}'`;

function seedSql(passwordHash) {
    const values = [...posts.values()].map((post, index) => {
        const region = regionIds[post.region];
        const createdAt = new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString().slice(0, 19).replace('T', ' ');
        return `(${post.id},${region},${region},${[post.category, post.status, post.title, post.body, createdAt].map(sqlString).join(',')})`;
    });
    return `USE zip;
        CREATE USER 'zip_eval'@'127.0.0.1' IDENTIFIED BY '${appPassword}';
        GRANT SELECT, INSERT, UPDATE, DELETE ON zip.* TO 'zip_eval'@'127.0.0.1';
        INSERT INTO regions (id,parent_id,name,level) VALUES
        (100001,NULL,'평가시',1),(100002,100001,'첫동네',2),(100003,100001,'이웃동네',2),(100004,100001,'다른동네',2);
        INSERT INTO region_neighbors VALUES (100002,100003),(100003,100002);
        INSERT INTO users (id,login_id,password_hash,nickname,region_id,role,region_verified_at) VALUES
        (100002,'zipeval02','${passwordHash}','평가회원',100002,'USER',NOW()),
        (100003,'zipeval03','${passwordHash}','평가이웃',100003,'USER',NOW()),
        (100004,'zipeval04','${passwordHash}','평가타동',100004,'USER',NOW());
        INSERT INTO posts (id,user_id,region_id,category,status,title,body,created_at) VALUES ${values.join(',')};`;
}

function eligible(id, scope, category) {
    const post = posts.get(id);
    return post?.status === 'VISIBLE' && regionsByScope[scope].includes(post.region) && (!category || post.category === category);
}

function score(rows, sort) {
    const positive = rows.filter(row => row.expected.length > 0);
    const negative = rows.filter(row => row.expected.length === 0);
    const ranks = positive.map(row => row[sort].findIndex(id => row.expected.includes(id)) + 1);
    return {
        queries: rows.length,
        positive: positive.length,
        negative: negative.length,
        hitAt1: ranks.filter(rank => rank === 1).length,
        hitAt5: ranks.filter(rank => rank > 0 && rank <= 5).length,
        positiveEmpty: positive.filter(row => !row[sort].length).length,
        positiveNoRelevantReturned: ranks.filter(rank => rank === 0).length,
        negativeNonEmpty: negative.filter(row => row[sort].length > 0).length,
    };
}

function gradeTopFive(ids, expected, partial) {
    return ids.slice(0, 5).map(id => expected.includes(id) ? 2 : partial.includes(id) ? 1 : 0);
}

function scoreTopFive(rows, sort) {
    const positives = rows.filter(row => row.expected.length > 0);
    const dcg = grades => grades.reduce((sum, grade, index) => sum + (2 ** grade - 1) / Math.log2(index + 2), 0);
    const grades = positives.flatMap(row => row.top5Grades[sort]);
    const ndcgSum = positives.reduce((sum, row) => {
        const ideal = [...row.expected.map(() => 2), ...row.partial.map(() => 1)].slice(0, 5);
        return sum + dcg(row.top5Grades[sort]) / dcg(ideal);
    }, 0);
    return {
        queries: positives.length,
        relevant: grades.filter(grade => grade === 2).length,
        partiallyRelevant: grades.filter(grade => grade === 1).length,
        irrelevant: grades.filter(grade => grade === 0).length,
        ndcgAt5: positives.length ? Number((ndcgSum / positives.length).toFixed(4)) : null,
    };
}

async function evaluate(request, token) {
    const rows = [];
    const unexpectedIds = [];
    let requests = 0;
    async function collect(test, scope, sort) {
        const seen = new Set();
        let suggestion = null;
        for (let page = 0; page <= posts.size; page++) {
            const params = new URLSearchParams({ scope, q: test.q, page });
            if (test.category) params.set('category', test.category);
            if (sort) params.set('sort', sort);
            const data = await request(`/api/posts?${params}`, { headers: { Authorization: `Bearer ${token}` } });
            requests++;
            assert(Array.isArray(data.items) && typeof data.hasNext === 'boolean', `${test.id}: invalid page response`);
            if (Object.hasOwn(data, 'suggestedQuery')) {
                assert(page === 0 && !data.hasNext && data.items.length === 0 &&
                    typeof data.suggestedQuery === 'string' && data.suggestedQuery !== test.q, `${test.id}: invalid suggestion`);
                suggestion = data.suggestedQuery;
            }
            for (const item of data.items) {
                const id = Number(item.id);
                if (!eligible(id, scope, test.category)) unexpectedIds.push({ case: test.id, scope, sort: sort ?? 'default', id });
                assert(!seen.has(id), `${test.id}: duplicate post ${id}`);
                seen.add(id);
            }
            if (!data.hasNext) return { ids: [...seen], suggestion };
            assert(data.items.length > 0, `${test.id}: empty page with hasNext`);
        }
        throw new Error(`${test.id}: pagination did not terminate`);
    }

    for (const test of fixture.cases) {
        for (const scope of Object.keys(regionsByScope)) {
            const expected = test.relevant.filter(id => eligible(id, scope, test.category));
            const relevance = await collect(test, scope, 'relevance');
            const latest = await collect(test, scope, 'latest');
            const defaultOrder = await collect(test, scope);
            const row = { case: test.id, scope, primary: scope === test.scope, expected, relevance: relevance.ids, latest: latest.ids,
                defaultMatchesRelevance: JSON.stringify(defaultOrder) === JSON.stringify(relevance) };
            if (fixture.evaluateGradedRelevance) {
                row.partial = (test.partiallyRelevant ?? []).filter(id => eligible(id, scope, test.category));
                row.top5Grades = Object.fromEntries(sorts.map(sort => [sort, gradeTopFive(row[sort], expected, row.partial)]));
            }
            assert.equal(latest.suggestion, relevance.suggestion, `${test.id}: suggestion depends on sort`);
            if (fixture.evaluateSuggestions || relevance.suggestion !== null) {
                const suggested = relevance.suggestion;
                const corrected = suggested ? await collect({ ...test, q: suggested }, scope, 'relevance') : null;
                if (suggested) assert(corrected.ids.length > 0 && !corrected.suggestion, `${test.id}: suggested search has no results`);
                row.suggestion = { actual: suggested, returnedPosts: corrected?.ids ?? [] };
                if (fixture.evaluateSuggestions) {
                    const correctedExpected = (test.correctedRelevant ?? []).filter(id => eligible(id, scope, test.category));
                    row.suggestion.expected = correctedExpected.length ? test.suggestedQuery : null;
                    row.suggestion.expectedPosts = correctedExpected;
                }
            }
            rows.push(row);
        }
    }
    return { rows, requests, unexpectedIds };
}

function scoreSuggestions(rows) {
    const expected = rows.filter(row => row.suggestion.expected !== null);
    const negative = rows.filter(row => row.suggestion.expected === null);
    return {
        expected: expected.length,
        correct: expected.filter(({ suggestion }) => suggestion.expected === suggestion.actual).length,
        correctedHitAt1: expected.filter(({ suggestion }) => suggestion.expectedPosts.includes(suggestion.returnedPosts[0])).length,
        correctedHitAt5: expected.filter(({ suggestion }) => suggestion.returnedPosts.slice(0, 5).some(id => suggestion.expectedPosts.includes(id))).length,
        negative: negative.length,
        incorrectOnNegative: negative.filter(({ suggestion }) => suggestion.actual !== null).length,
    };
}

async function main() {
    assert.equal(process.platform, 'win32', 'Windows isolated MySQL runner');
    assert(process.env.JAVA_HOME && fs.existsSync(java), 'Set JAVA_HOME to the JDK used to build the backend');
    assert(fs.existsSync(jar), 'Build backend bootJar first');
    assert(fixture.cases.length > 0, 'empty evaluation cases');
    assert.equal(new Set(fixture.cases.map(test => test.id)).size, fixture.cases.length);
    assert.equal(new Set(fixture.cases.map(test => test.q)).size, fixture.cases.length);
    assert.equal(posts.size, fixture.posts.length, 'duplicate fixture post IDs');
    assert(fixture.cases.every(test => test.q.trim() && test.q.length <= 40 && test.scope in regionsByScope &&
        [test.relevant, test.partiallyRelevant ?? [], test.correctedRelevant ?? []].flat()
            .every(id => posts.get(id)?.status === 'VISIBLE')), 'invalid query, scope or expected post');
    assert(fixture.cases.every(test => (test.partiallyRelevant ?? []).every(id => !test.relevant.includes(id))),
        'a post cannot be both fully and partially relevant');

    const privateDir = path.join(root, 'db/private');
    fs.mkdirSync(privateDir, { recursive: true });
    const work = fs.mkdtempSync(path.join(privateDir, 'community-search-'));
    console.log('Isolated run:', work);
    const initFile = path.join(work, 'mysql-init.sql');
    const dataDir = path.join(work, 'mysql-data');
    const mysqlServer = path.join(mysqlHome, 'bin/mysqld.exe');
    const mysqlClient = path.join(mysqlHome, 'bin/mysql.exe');
    fs.mkdirSync(dataDir);
    const dbPort = await freePort();
    const apiPort = await freePort();
    assert.notEqual(dbPort, apiPort);
    const mysql = input => execute(mysqlClient, [
        '--no-defaults', '--no-login-paths', '--protocol=TCP', '--host=127.0.0.1', `--port=${dbPort}`,
        '--user=root', '--connect-timeout=2', '--default-character-set=utf8mb4', '--batch', '--raw', '--skip-column-names',
    ], { input, env: { ...process.env, MYSQL_PWD: rootPassword } });

    execute(mysqlServer, ['--no-defaults', '--initialize-insecure', `--basedir=${mysqlHome}`, `--datadir=${dataDir}`]);
    fs.writeFileSync(initFile, `ALTER USER 'root'@'localhost' IDENTIFIED BY '${rootPassword}';\n`);
    let version;
    try {
        const db = launch(work, 'mysql', mysqlServer, ['--no-defaults', `--basedir=${mysqlHome}`, `--datadir=${dataDir}`,
            `--init-file=${initFile}`, '--bind-address=127.0.0.1', `--port=${dbPort}`, '--mysqlx=OFF', '--skip-log-bin',
            '--innodb-buffer-pool-size=128M', '--secure-file-priv=NULL']);
        version = await waitFor('MySQL', db, () => {
            const [engine, actualDirectory] = mysql('SELECT VERSION(), @@datadir;').split('\t');
            assert.equal(path.resolve(actualDirectory).toLowerCase(), path.resolve(dataDir).toLowerCase());
            return engine;
        });
    } finally {
        fs.unlinkSync(initFile);
    }

    mysql(fs.readFileSync(path.join(root, 'db/schema.sql'), 'utf8'));
    execute(path.join(process.env.JAVA_HOME, 'bin/jar.exe'), ['xf', jar, 'BOOT-INF/classes/com/zip/backend/tools/PasswordHash.class', 'BOOT-INF/lib'], { cwd: work });
    const classpath = `${path.join(work, 'BOOT-INF/classes')};${path.join(work, 'BOOT-INF/lib/*')}`;
    const hash = execute(java, ['-cp', classpath, 'com.zip.backend.tools.PasswordHash'], { input: `${loginPassword}\n` });
    mysql(seedSql(hash));

    const api = launch(work, 'backend', java, ['-Dfile.encoding=UTF-8', '-XX:ActiveProcessorCount=4', '-jar', jar,
        `--server.port=${apiPort}`, '--server.address=127.0.0.1', '--spring.config.import=', '--spring.main.banner-mode=off',
        `--spring.datasource.url=jdbc:mysql://127.0.0.1:${dbPort}/zip?characterEncoding=UTF-8&connectionTimeZone=UTC`,
        '--spring.datasource.username=zip_eval', `--spring.datasource.password=${appPassword}`,
        `--zip.auth.jwt-secret=${randomBytes(32).toString('base64')}`, `--zip.files.directory=${path.join(work, 'uploads')}`,
        '--zip.trash.reminder.enabled=false', '--zip.rent.reminder.enabled=false', '--zip.bills.auto-register.enabled=false',
        '--zip.cleanup.enabled=false', '--zip.mail.log-only=true']);
    async function request(route, options = {}, expected = 200) {
        const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, { ...options, signal: AbortSignal.timeout(15000) });
        assert.equal(response.status, expected, `${route}: unexpected HTTP status`);
        const body = await response.text();
        return body ? JSON.parse(body) : null;
    }
    await waitFor('ZIP API', api, () => request('/api/posts', {}, 401));
    const login = await request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: 'zipeval02', password: loginPassword }) });
    const { rows, requests, unexpectedIds } = await evaluate(request, login.accessToken);

    const primary = rows.filter(row => row.primary);
    const scoreBoth = group => Object.fromEntries(sorts.map(sort => [sort, score(group, sort)]));
    const report = {
        fixture: fixture.version,
        fixtureSha256: sha256(fixtureText),
        gitBase: execute('git', ['rev-parse', 'HEAD'], { cwd: root }),
        backendJarSha256: sha256(fs.readFileSync(jar)),
        mysql: version,
        fixturePosts: posts.size,
        searchRequests: requests,
        defaultMatches: rows.filter(row => row.defaultMatchesRelevance).length,
        unexpectedIds,
        primary: scoreBoth(primary),
        byScope: Object.fromEntries(Object.keys(regionsByScope).map(scope => [scope, scoreBoth(rows.filter(row => row.scope === scope))])),
    };
    if (fixture.evaluateGradedRelevance) report.primaryTop5Quality = Object.fromEntries(sorts.map(sort => [sort, scoreTopFive(primary, sort)]));
    if (fixture.evaluateSuggestions) report.suggestions = { primary: scoreSuggestions(primary), allScopes: scoreSuggestions(rows) };
    const resultFile = path.join(work, 'results.json');
    const rowLines = rows.map(row => `    ${JSON.stringify(row)}`).join(',\n');
    fs.writeFileSync(resultFile, `${JSON.stringify(report, null, 2).slice(0, -2)},\n  "rows": [\n${rowLines}\n  ]\n}\n`);
    console.log(JSON.stringify(report.suggestions ?? report.primary), '\nResults:', resultFile);
    assert.equal(unexpectedIds.length, 0, 'out-of-scope, wrong-category, hidden, deleted, or unseeded posts returned');
    assert.equal(report.defaultMatches, rows.length, 'the default search differs from relevance');
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
    for (const child of processes.reverse()) {
        if (child.pid && child.exitCode === null) spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
    }
});
