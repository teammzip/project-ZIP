package com.zip.backend;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.zip.backend.bills.BillQrReader;
import java.io.ByteArrayOutputStream;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class BillQrReaderTests {
    @Test void decodesQrPixelsWithoutOpeningUrl() throws Exception {
        String text="https://example.invalid/bill?amount=42000&dueDate=2026-12-05";
        var output=new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(new MultiFormatWriter().encode(text,BarcodeFormat.QR_CODE,320,320),"PNG",output);
        assertEquals(text,BillQrReader.read(output.toByteArray()));
    }
    @Test void invalidImageHasNoQr() {
        assertEquals("",BillQrReader.read(new byte[]{1,2,3}));
    }
}
