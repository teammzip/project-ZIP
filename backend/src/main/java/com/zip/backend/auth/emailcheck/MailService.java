package com.zip.backend.auth.emailcheck;

import com.zip.backend.common.ApiException;
import jakarta.mail.internet.InternetAddress;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Sends plain-text mail through SMTP (Gmail by default). Without MAIL_USERNAME and MAIL_PASSWORD nothing is sent:
 * the message is written to the server log instead, so the app can be developed and demoed without a mail account.
 */
@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final ObjectProvider<JavaMailSender> sender;
    private final String username;
    private final String password;
    // 개발용 로그 출력 모드를 명시적으로 켰는지. 기본 false: 운영에서 메일 설정을 빠뜨렸을 때
    // 인증번호가 로그에 남고 사용자에겐 "성공"처럼 보이는 사고를 막기 위한 안전장치.
    private final boolean logOnly;

    public MailService(ObjectProvider<JavaMailSender> sender, @Value("${zip.mail.username:}") String username,
        @Value("${zip.mail.password:}") String password, @Value("${zip.mail.log-only:false}") boolean logOnly) {
        this.sender = sender;
        this.logOnly = logOnly;
        this.username = username == null ? "" : username.strip();
        this.password = password == null ? "" : password.strip();
    }

    public boolean enabled() {
        return !username.isEmpty() && !password.isEmpty() && sender.getIfAvailable() != null;
    }

    public void send(String to, String subject, String text) {
        if (!enabled()) {
            // 메일 설정이 없는데 log-only 도 아니면 보내지 않고 오류로 끝낸다(코드를 로그에 찍지 않음).
            if (!logOnly) {
                log.error("메일 설정(MAIL_USERNAME/MAIL_PASSWORD)이 없어 인증 메일을 보낼 수 없어요. 개발 중이면 MAIL_LOG_ONLY=true 로 켜세요.");
                throw new ApiException(503, "메일 서비스가 준비되지 않았어요. 관리자에게 문의해 주세요.", "MAIL_NOT_CONFIGURED");
            }
            log.warn("[메일 설정 없음 - 보내지 않고 로그로만 남겨요] to={} / {} / {}", to, subject, text.replace('\n', ' '));
            return;
        }
        try {
            var mailSender = sender.getObject();
            var message = mailSender.createMimeMessage();
            var helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(new InternetAddress(username, "ZIP", "UTF-8"));
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text, false);
            mailSender.send(message);
        } catch (Exception error) {
            // the mail body (it holds the code) and the password are never logged
            log.warn("Mail send failed: {}", error.toString());
            throw new ApiException(502, "메일을 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요.", "MAIL_FAILED");
        }
    }
}
