package com.zip.backend.bills;

import com.google.zxing.*;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import java.io.*;
import javax.imageio.ImageIO;

/** Decode uploaded pixels only; never open URLs contained in an untrusted QR. */
public final class BillQrReader {
    private BillQrReader() {}
    public static String read(byte[] bytes) {
        try (var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers=ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) return "";
            var reader=readers.next();
            try {
                reader.setInput(stream);
                if ((long)reader.getWidth(0)*reader.getHeight(0)>20_000_000) throw BillInput.bad("사진 크기가 너무 커요. 해상도를 줄여 주세요.");
                var image=reader.read(0);
                return new MultiFormatReader().decode(new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(image))),
                    java.util.Map.of(DecodeHintType.POSSIBLE_FORMATS,java.util.List.of(BarcodeFormat.QR_CODE),DecodeHintType.TRY_HARDER,true)).getText();
            } finally { reader.dispose(); }
        } catch (IOException | NotFoundException error) { return ""; }
    }
}
