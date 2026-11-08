package com.zip.backend.files;

import org.springframework.core.io.FileSystemResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class ProfileFileController {
    private final ProfileFileService files;
    public ProfileFileController(ProfileFileService files) { this.files = files; }

    @PostMapping(value = "/api/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProfileFileService.Uploaded upload(@AuthenticationPrincipal Jwt jwt, @RequestParam("file") MultipartFile file) {
        return files.upload(Long.parseLong(jwt.getSubject()), Long.parseLong(jwt.getClaimAsString("sid")), file);
    }

    // Only referenced profile pictures are public; unlinked uploads require their owner's token.
    @GetMapping("/api/files/content/{key}")
    public ResponseEntity<FileSystemResource> content(@PathVariable String key, @AuthenticationPrincipal Jwt jwt) {
        var content = files.content(key, jwt == null ? null : Long.parseLong(jwt.getSubject()));
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(content.mimeType()))
            .header("X-Content-Type-Options", "nosniff").cacheControl(CacheControl.noStore())
            .body(new FileSystemResource(content.path()));
    }
}
