package com.zip.backend.files;

import com.zip.backend.auth.AuthRepository;
import com.zip.backend.common.ApiException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ProfileFileService {
    private static final long MAX_BYTES = 2 * 1024 * 1024;
    private final Path root;
    private final JdbcTemplate jdbc;
    private final AuthRepository auth;
    private final java.time.Clock clock;

    public ProfileFileService(@Value("${zip.files.directory:./var/uploads}") String directory, JdbcTemplate jdbc, AuthRepository auth, java.time.Clock clock) {
        if (directory.isBlank()) throw new IllegalArgumentException("ZIP_UPLOAD_DIR must not be blank");
        this.root = Path.of(directory).toAbsolutePath().normalize();
        this.jdbc = jdbc;
        this.auth = auth;
        this.clock = clock;
    }

    public record Uploaded(String id, String name, String type, long size, String url) {}
    public record Content(Path path, String mimeType) {}

    @Transactional
    public Uploaded upload(long userId, long sessionId, MultipartFile file) {
        auth.lockUser(userId);
        if (!auth.sessionActive(sessionId, userId, clock.instant())) throw new ApiException(401, "로그인이 만료됐어요.");
        if (file.isEmpty()) throw new ApiException(400, "사진 파일을 골라 주세요.");
        if (file.getSize() > MAX_BYTES) throw new ApiException(413, "사진은 2MB 이하여야 해요.");
        String declared = file.getContentType();
        if (!"image/jpeg".equals(declared) && !"image/png".equals(declared)) {
            throw new ApiException(400, "프로필 사진은 JPEG 또는 PNG만 올릴 수 있어요.");
        }
        try {
            BufferedImage image;
            String format;
            try (var source = file.getInputStream(); var stream = ImageIO.createImageInputStream(source)) {
                var readers = ImageIO.getImageReaders(stream);
                if (!readers.hasNext()) throw new ApiException(400, "올바른 사진 파일이 아니에요.");
                var reader = readers.next();
                try {
                    reader.setInput(stream);
                    format = reader.getFormatName().toLowerCase(java.util.Locale.ROOT);
                    if (!(format.equals("jpeg") || format.equals("png"))
                        || !("image/" + format).equals(declared)) throw new ApiException(400, "사진 내용과 파일 형식이 맞지 않아요.");
                    int width = reader.getWidth(0), height = reader.getHeight(0);
                    if (width <= 0 || height <= 0 || width > 4096 || height > 4096 || (long) width * height > 16_000_000) {
                        throw new ApiException(400, "사진은 가로·세로 4096px 이하, 1600만 화소 이하여야 해요.");
                    }
                    image = reader.read(0);
                } finally { reader.dispose(); }
            } catch (IOException | IllegalArgumentException error) {
                throw new ApiException(400, "올바른 JPEG 또는 PNG 사진이 아니에요.");
            }
            // Re-encode pixels only: drop embedded metadata and original executable/polyglot bytes.
            var bytes = new ByteArrayOutputStream();
            if (!ImageIO.write(image, format, bytes)) throw new ApiException(400, "사진을 처리할 수 없어요.");
            if (bytes.size() > MAX_BYTES) throw new ApiException(413, "처리된 사진은 2MB 이하여야 해요.");
            String key = UUID.randomUUID() + (format.equals("jpeg") ? ".jpg" : ".png");
            Path target = root.resolve(key).normalize();
            Files.createDirectories(root);
            // Register before writing so even a failed/partial write is removed on rollback.
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCompletion(int status) {
                    if (status != STATUS_COMMITTED) {
                        try { Files.deleteIfExists(target); }
                        catch (IOException error) { org.slf4j.LoggerFactory.getLogger(ProfileFileService.class).error("Failed to clean rolled-back upload {}", target, error); }
                    }
                }
            });
            Files.write(target, bytes.toByteArray(), java.nio.file.StandardOpenOption.CREATE_NEW);
            String url = "/api/files/content/" + key;
            String name = file.getOriginalFilename();
            name = name == null ? "profile." + format : name.replace('\\', '/');
            name = name.substring(name.lastIndexOf('/') + 1);
            name = name.length() > 255 ? name.substring(0, 255) : name;
            if (name.isBlank()) name = "profile." + format;
            String storedName = name;
            var keys = new GeneratedKeyHolder();
            jdbc.update(connection -> {
                var ps = connection.prepareStatement("INSERT INTO uploaded_files (user_id, original_name, storage_url, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?)", new String[] {"id"});
                ps.setLong(1, userId); ps.setString(2, storedName); ps.setString(3, url);
                ps.setString(4, declared); ps.setInt(5, bytes.size()); return ps;
            }, keys);
            return new Uploaded(keys.getKey().toString(), name, declared, bytes.size(), url);
        } catch (IOException error) {
            throw new ApiException(500, "사진을 저장할 수 없어요. 다시 시도해 주세요.");
        }
    }

    public Content content(String key, Long viewerId) {
        if (!key.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png)")) {
            throw new ApiException(404, "사진이 없어요.");
        }
        String url = "/api/files/content/" + key;
        var types = jdbc.query("""
            SELECT f.mime_type FROM uploaded_files f WHERE f.storage_url = ? AND f.deleted_at IS NULL
            AND (f.user_id = ? OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.avatar_file_id = f.id AND p.user_id = f.user_id))
            """, (rs, row) -> rs.getString(1), url, viewerId);
        Path target = root.resolve(key).normalize();
        if (!target.startsWith(root) || types.isEmpty() || !Files.isRegularFile(target)) throw new ApiException(404, "사진이 없어요.");
        return new Content(target, types.get(0));
    }
}
