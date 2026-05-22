package com.contentvelocity.service;

import com.contentvelocity.model.AiScores;
import com.contentvelocity.model.AuditCheck;
import com.contentvelocity.model.PageData;
import com.contentvelocity.model.PageScores;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ScoreCalculator {

    public PageScores calculate(List<AuditCheck> checks, AiScores ai, PageData page) {

        // SEO score: rule-based 75% + AI boost 25% (unchanged)
        int seoEarned = 0, seoMax = 0;
        for (AuditCheck c : checks) {
            if (isSeoCategory(c.category)) {
                seoMax += c.weight;
                if (c.pass) seoEarned += c.weight;
            }
        }
        int seoBase  = seoMax > 0 ? Math.round((float) seoEarned / seoMax * 75) : 0;
        int seoBoost = ai != null ? calcSeoAiBoost(ai) : 10;
        int seoScore = Math.min(100, seoBase + seoBoost);

        // GEO score: geo-rules formula (50% objective + 50% subjective)
        double objectiveScore  = calcObjectiveGeoScore(page);
        double subjectiveScore = ai != null ? calcSubjectiveGeoScore(ai) : 0.5;
        int geoScore = (int) Math.round((0.5 * objectiveScore + 0.5 * subjectiveScore) * 100);
        geoScore = Math.min(100, Math.max(0, geoScore));

        return new PageScores(seoScore, geoScore);
    }

    private boolean isSeoCategory(String category) {
        return category.equals("On-page") ||
               category.equals("Technical") ||
               category.equals("Content");
    }

    private int calcSeoAiBoost(AiScores ai) {
        // clarity ≈ readability (0-10), relevance ≈ intent match (0-8), authority ≈ depth (0-7)
        return (int) Math.round(ai.clarity * 10 + ai.relevance * 8 + ai.authority * 7);
    }

    private double calcObjectiveGeoScore(PageData p) {
        // structuredData (20%)
        double structuredData = p.totalSchemaFields == 0 ? 0.0
            : clamp((double) p.validSchemaFields / p.totalSchemaFields);

        // citationReadiness (20%)
        double citationReadiness = clamp(
            0.4 * clamp(p.externalLinkCount / 10.0) +
            0.3 * clamp(p.internalLinkCount  / 10.0) +
            0.3 * clamp(p.quotationCount     / 5.0));

        // factualDensity (20%)
        double factualDensity = p.totalSentences == 0 ? 0.0
            : clamp((double) p.factualStatementCount / p.totalSentences);

        // contentModularity (15%): clamp(50/avgChunkSize) per geo_ruling.js
        double chunkScore = p.avgChunkSize == 0 ? 0.0 : clamp(50.0 / p.avgChunkSize);
        double contentModularity = clamp(
            0.4 * clamp(p.headingCount / 10.0) +
            0.3 * clamp(p.listCount    / 10.0) +
            0.3 * chunkScore);

        // technicalDensity (15%): normalise ratio against 10% baseline per geo_ruling.js
        double technicalDensity = p.totalWords == 0 ? 0.0
            : clamp(((double) p.technicalTermCount / p.totalWords) / 0.1);

        // freshness (10%)
        double freshness = p.daysSinceLastUpdate == null ? 0.4
            : p.daysSinceLastUpdate < 30  ? 1.0
            : p.daysSinceLastUpdate < 180 ? 0.7 : 0.4;

        return 0.20 * structuredData +
               0.20 * citationReadiness +
               0.20 * factualDensity +
               0.15 * contentModularity +
               0.15 * technicalDensity +
               0.10 * freshness;
    }

    private double calcSubjectiveGeoScore(AiScores ai) {
        return 0.20 * ai.relevance +
               0.15 * ai.authority +
               0.15 * ai.clarity +
               0.15 * ai.conversationalFit +
               0.10 * ai.uniqueness +
               0.10 * ai.engagement +
               0.15 * ai.trustworthiness;
    }

    private double clamp(double v) {
        return Math.max(0.0, Math.min(1.0, v));
    }
}
