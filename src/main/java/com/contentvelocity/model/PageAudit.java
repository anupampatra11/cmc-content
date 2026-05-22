package com.contentvelocity.model;

import java.util.List;

public class PageAudit {
    public String url;
    public String title;
    public String slug;
    public PageScores scores;
    public List<AuditCheck> checks;
    public AiScores aiScores;
    public String status; // "pending" | "complete" | "error"
    public String errorMessage;
}
