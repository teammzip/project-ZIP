package com.zip.backend.bills;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.HexFormat;
import java.util.Locale;
import tools.jackson.databind.JsonNode;

/** Only explicit printed identifiers are used; category, amount and date alone are not identity. */
public final class BillDocumentIdentity {
    private BillDocumentIdentity() {}
    public static String from(JsonNode root) {
        String issuer=clean(root.path("issuer").asText(""));
        String reference=clean(root.path("billReference").asText(""));
        String period=root.path("billingMonth").asText("");
        if (issuer.isBlank() || reference.isBlank() || issuer.length()>200 || reference.length()>200) return null;
        try { BillInput.month(period); } catch(RuntimeException error) { return null; }
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((issuer+"|"+reference+"|"+period).getBytes(StandardCharsets.UTF_8)));
        } catch(java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }
    private static String clean(String value) {
        return Normalizer.normalize(value,Normalizer.Form.NFKC).toUpperCase(Locale.ROOT).replaceAll("[\\s\\p{Z}\\p{Pd}]+","");
    }
}
