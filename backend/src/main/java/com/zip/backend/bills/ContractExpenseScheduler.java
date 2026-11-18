package com.zip.backend.bills;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Configuration
@EnableScheduling
@ConditionalOnProperty(name="zip.bills.auto-register.enabled",havingValue="true",matchIfMissing=true)
public class ContractExpenseScheduler {
    private static final Logger log=LoggerFactory.getLogger(ContractExpenseScheduler.class);
    private final BillRepository repository;
    private final BillService service;
    public ContractExpenseScheduler(BillRepository repository,BillService service) { this.repository=repository; this.service=service; }
    @Scheduled(initialDelayString="60000",fixedDelayString="60000")
    public void registerCurrentMonths() {
        for(var owner:repository.autoOwners()) {
            try { service.autoRegisterSavedZone(owner.user()); }
            catch(RuntimeException error) { log.warn("Contract expense registration failed for user {} ({})",owner.user(),error.getClass().getSimpleName()); }
        }
    }
}
