package com.zip.backend.ledger;

import com.zip.backend.ledger.LedgerCategoryService.Change;
import com.zip.backend.ledger.LedgerCategoryService.Selection;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me/ledger-categories")
public class LedgerCategoriesController {
    private final LedgerCategoryService categories;

    public LedgerCategoriesController(LedgerCategoryService categories) {
        this.categories = categories;
    }

    @GetMapping
    public Selection read(@AuthenticationPrincipal Jwt jwt, @RequestParam String scope) {
        return categories.read(Long.parseLong(jwt.getSubject()), scope);
    }

    @PostMapping
    public Selection change(@AuthenticationPrincipal Jwt jwt, @RequestParam String scope, @RequestBody Change change) {
        return categories.change(Long.parseLong(jwt.getSubject()), Long.parseLong(jwt.getClaimAsString("sid")), scope, change);
    }
}
