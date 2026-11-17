import java.nio.file.*;
import java.util.*;
import java.time.*;
import org.springframework.jdbc.datasource.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import com.zip.backend.bills.*;
import com.zip.backend.auth.AuthRepository;
import com.zip.backend.common.ApiException;

/** Run with verify-monthly-mysql.init.gradle. Fixture data is always rolled back. */
public class MonthlyBillsMysqlVerify {
    @SuppressWarnings("unchecked") public static void main(String[] args) throws Exception {
        var properties=new Properties();
        if (Files.exists(Path.of("application-local.properties"))) try(var r=Files.newBufferedReader(Path.of("application-local.properties"))){ properties.load(r); }
        var ds=new DriverManagerDataSource(System.getenv().getOrDefault("DB_URL",properties.getProperty("DB_URL")),
            System.getenv().getOrDefault("DB_USERNAME",properties.getProperty("DB_USERNAME")),
            System.getenv().getOrDefault("DB_PASSWORD",properties.getProperty("DB_PASSWORD")));
        var jdbc=new JdbcTemplate(ds);
        boolean hasDue=jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bill_payments' AND COLUMN_NAME='due_date'",Integer.class)>0;
        boolean hasImports=jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bill_photo_imports'",Integer.class)>0;
        boolean hasMemo=jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bill_payments' AND COLUMN_NAME='memo'",Integer.class)>0;
        boolean hasDocuments=jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bill_document_keys'",Integer.class)>0;
        boolean hasDeleted=jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bill_payments' AND COLUMN_NAME='deleted_at'",Integer.class)>0;
        if (Arrays.asList(args).contains("--apply-migration")) {
            var sql=Files.readString(Path.of("../db/migrations/20261118_01_bill_monthly_registration.sql"));
            if (!hasDue) jdbc.execute("ALTER TABLE bill_payments ADD COLUMN due_date DATE NULL COMMENT '월별 납부 기한'");
            if (!hasImports) jdbc.execute(sql.substring(sql.indexOf("CREATE TABLE")));
            if (!hasMemo) jdbc.execute("ALTER TABLE bill_payments ADD COLUMN memo VARCHAR(200) NULL COMMENT '월별 고정 지출 메모'");
            if (!hasDocuments) jdbc.execute(Files.readString(Path.of("../db/migrations/20261118_03_bill_document_keys.sql")));
            var deleteSql=Files.readString(Path.of("../db/migrations/20261118_04_bill_monthly_delete.sql"));
            if (!hasDeleted) jdbc.execute(deleteSql.substring(0,deleteSql.indexOf(';')));
            jdbc.execute(deleteSql.substring(deleteSql.indexOf(';')+1).trim());
            System.out.println("Monthly migration applied (existing data preserved).");
        } else if (!hasDue || !hasImports || !hasMemo || !hasDocuments || !hasDeleted) throw new IllegalStateException("Apply monthly migrations 20261118_01 through 04 first.");
        new TransactionTemplate(new DataSourceTransactionManager(ds)).execute(status->{
            try {
                jdbc.update("INSERT INTO users(nickname) VALUES ('월별저장검증')");
                long user=jdbc.queryForObject("SELECT LAST_INSERT_ID()",Long.class);
                jdbc.update("INSERT INTO auth_sessions(user_id,refresh_token_hash,remember,created_at,expires_at) VALUES (?, ?,false,CURRENT_TIMESTAMP,DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 1 DAY))",user,UUID.randomUUID().toString().replace("-","").repeat(2));
                long session=jdbc.queryForObject("SELECT LAST_INSERT_ID()",Long.class);
                var service=new BillService(new BillRepository(jdbc),new AuthRepository(jdbc),Clock.systemUTC());
                var month=YearMonth.now(ZoneOffset.UTC);
                var saved=service.registerMonthly(user,session,month.toString(),"UTC",Map.of("name","검증전기","tag","공과금","amount",40000,"dueDate",month.atEndOfMonth().toString()));
                long id=Long.parseLong((String)saved.get("id"));
                jdbc.update("INSERT INTO bill_payments(bill_item_id,period_ym,amount) VALUES (?,?,30000)",id,month.minusMonths(1).toString());
                var edited=service.updateMonthly(user,session,id,month.toString(),"UTC",Map.of("amount",45000,"dueDate",month.atEndOfMonth().toString(),"memo","고정 지출 양식 검증"));
                if (!edited.get("memo").equals("고정 지출 양식 검증")) throw new IllegalStateException("memo persistence failed");
                if (!edited.get("amount").equals(45000L) || !edited.get("snapshot").equals(true)) throw new IllegalStateException("monthly edit failed");
                if(jdbc.queryForObject("SELECT amount FROM bill_payments WHERE bill_item_id=? AND period_ym=?",Long.class,id,month.minusMonths(1).toString())!=30000L) throw new IllegalStateException("history changed");
                try { service.updateMonthly(user,session,id,month.minusMonths(2).toString(),"UTC",Map.of("amount",1,"dueDate",month.atEndOfMonth().toString())); throw new IllegalStateException("unregistered edit allowed"); }
                catch (ApiException error) { if(error.status()!=404) throw error; }
                long before=jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments WHERE bill_item_id=?",Long.class,id);
                var items=(List<Map<String,Object>>)service.monthly(user,month,"UTC").get("items");
                if(items.size()!=1 || !items.get(0).get("amount").equals(45000L) || !items.get(0).get("dueDate").equals(month.atEndOfMonth().toString())) throw new IllegalStateException("read after write failed");
                if(before!=jdbc.queryForObject("SELECT COUNT(*) FROM bill_payments WHERE bill_item_id=?",Long.class,id)) throw new IllegalStateException("read mutated rows");
                String hash="a".repeat(64);
                var photoBill=service.registerPhoto(user,session,month.toString(),"UTC",hash,"b".repeat(64),Map.of("name","사진검증","tag","공과금","amount",12000,"dueDate",month.atEndOfMonth().toString()));
                try { service.registerPhoto(user,session,month.toString(),"UTC","c".repeat(64),"b".repeat(64),Map.of("name","사진검증","tag","공과금","amount",12000,"dueDate",month.atEndOfMonth().toString())); throw new IllegalStateException("recognized document duplicate allowed"); }
                catch(ApiException error) { if(error.status()!=409) throw error; }
                try { service.registerMonthly(user,session,month.toString(),"UTC",Map.of("tag","통신","amount",1,"dueDate",LocalDate.now(ZoneOffset.UTC).minusDays(1).toString())); throw new IllegalStateException("past deadline allowed"); }
                catch(ApiException error) { if(error.status()!=400) throw error; }
                var ai=new com.zip.backend.ai.AiService(new com.zip.backend.ai.GeminiClient("","unused"),new com.zip.backend.ai.AiRepository(jdbc),jdbc,new TransactionTemplate(new DataSourceTransactionManager(ds)),tools.jackson.databind.json.JsonMapper.builder().build(),Clock.systemUTC(),30);
                long conversation=Long.parseLong((String)ai.create(user,"AI_PAGE",null).get("id"));
                ai.record(user,conversation,"고지서를 등록해 주세요.","사진검증 12000원을 고정 지출에 등록했어요.",new com.zip.backend.ai.AiService.CardInput("LINK",Map.of("to","/my/budget/expense","bill",photoBill)));
                if (jdbc.queryForObject("SELECT COUNT(*) FROM ai_messages WHERE conversation_id=?",Integer.class,conversation)!=2) throw new IllegalStateException("AI conversation not stored");
                if (!jdbc.queryForObject("SELECT card_type FROM ai_messages WHERE conversation_id=? AND role='ASSISTANT'",String.class,conversation).equals("LINK")) throw new IllegalStateException("AI bill link not stored");
                if(jdbc.queryForObject("SELECT COUNT(*) FROM bill_photo_imports WHERE user_id=?",Integer.class,user)!=1) throw new IllegalStateException("photo tracking failed");
                try { service.registerPhoto(user,session,month.toString(),"UTC",hash,Map.of("name","사진검증","tag","공과금","amount",12000,"dueDate",month.atEndOfMonth().toString())); throw new IllegalStateException("duplicate photo allowed"); }
                catch(ApiException error) { if(error.status()!=409) throw error; }
                var anotherBill=service.registerPhoto(user,session,month.toString(),"UTC","d".repeat(64),"e".repeat(64),Map.of("name","사진검증","tag","공과금","amount",12000,"dueDate",month.atEndOfMonth().toString()));
                if (anotherBill.get("id").equals(photoBill.get("id"))) throw new IllegalStateException("distinct documents merged");
                if (jdbc.queryForObject("SELECT COUNT(*) FROM bill_document_keys WHERE user_id=?",Integer.class,user)!=2) throw new IllegalStateException("distinct document not stored");
                service.deleteMonthly(user,session,id,month.toString(),"UTC");
                service.deleteMonthly(user,session,id,month.toString(),"UTC");
                if(jdbc.queryForObject("SELECT deleted_at IS NOT NULL FROM bill_payments WHERE bill_item_id=? AND period_ym=?",Integer.class,id,month.toString())!=1) throw new IllegalStateException("delete timestamp missing");
                var remaining=(List<Map<String,Object>>)service.monthly(user,month,"UTC").get("items");
                if(remaining.stream().anyMatch(b->b.get("id").equals(Long.toString(id)))) throw new IllegalStateException("deleted bill reappeared");
                long visibleTotal=remaining.stream().mapToLong(b->(Long)b.get("amount")).sum();
                long viewTotal=jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM v_monthly_spend_breakdown WHERE user_id=? AND period_ym=?",Long.class,user,month.toString());
                if(viewTotal!=visibleTotal) throw new IllegalStateException("deleted bill included in summary view");
                if(jdbc.queryForObject("SELECT amount FROM bill_payments WHERE bill_item_id=? AND period_ym=? AND deleted_at IS NULL",Long.class,id,month.minusMonths(1).toString())!=30000L) throw new IllegalStateException("delete changed history");
                long photoId=Long.parseLong((String)photoBill.get("id"));
                service.deleteMonthly(user,session,photoId,month.toString(),"UTC");
                if(jdbc.queryForObject("SELECT COUNT(*) FROM bill_document_keys WHERE user_id=?",Integer.class,user)!=2) throw new IllegalStateException("delete removed duplicate protection");
                System.out.println("MySQL PASS: monthly deletion, repeat deletion, summary view exclusion, history and document identity preserved; monthly create/edit/read, memo, past deadline blocked, historical preservation, identical document blocked, distinct documents allowed, AI conversation, fixture rollback.");
                return null;
            } finally { status.setRollbackOnly(); }
        });
        System.out.println("Verification fixture data rolled back. Migration remains applied.");
    }
}
