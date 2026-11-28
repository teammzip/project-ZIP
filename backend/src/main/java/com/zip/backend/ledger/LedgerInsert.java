package com.zip.backend.ledger;

import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.jdbc.core.ArgumentPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;

final class LedgerInsert {
    private LedgerInsert() {}

    static long withGeneratedId(JdbcTemplate jdbc, String sql, Object... args) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(sql, new String[]{"id"});
            new ArgumentPreparedStatementSetter(args).setValues(statement);
            return statement;
        }, keys);
        var key = keys.getKey();
        if (key == null || key.longValue() <= 0) {
            throw new DataRetrievalFailureException("Ledger insert did not return a valid id");
        }
        return key.longValue();
    }
}
