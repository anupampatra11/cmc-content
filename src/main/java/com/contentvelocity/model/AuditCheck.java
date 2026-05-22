package com.contentvelocity.model;

public class AuditCheck {
    public String id;
    public String category;
    public String label;
    public boolean pass;
    public String detail;
    public int weight;
    public String howToFix;     // plain-English fix instruction (null when passing)
    public String codeExample;  // copy-paste HTML/JSON-LD snippet (null when passing)

    public AuditCheck(String id, String category, String label,
                      boolean pass, String detail, int weight) {
        this.id = id;
        this.category = category;
        this.label = label;
        this.pass = pass;
        this.detail = detail;
        this.weight = weight;
    }

    /**
     * Fluent builder — only attaches fix guidance when the check actually fails.
     * This means passing checks never carry howToFix/codeExample noise.
     */
    public AuditCheck withFix(boolean shouldAttach, String howToFix, String codeExample) {
        if (shouldAttach) {
            this.howToFix = howToFix;
            this.codeExample = codeExample;
        }
        return this;
    }
}
