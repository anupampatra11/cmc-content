package com.contentvelocity.model;

public class PageScores {
    public int seo;
    public int geo;
    public int combined;
    public String seoBand;
    public String geoBand;
    public String combinedBand;

    public PageScores(int seo, int geo) {
        this.seo = Math.min(100, Math.max(0, seo));
        this.geo = Math.min(100, Math.max(0, geo));
        this.combined = Math.round(this.seo * 0.5f + this.geo * 0.5f);
        this.seoBand = band(this.seo);
        this.geoBand = band(this.geo);
        this.combinedBand = band(this.combined);
    }

    private String band(int score) {
        if (score >= 80) return "Excellent";
        if (score >= 60) return "Good";
        if (score >= 40) return "Needs work";
        return "Critical";
    }
}
