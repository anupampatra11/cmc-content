package com.contentvelocity.model;

import java.util.List;

public class PageData {
    public String url;
    public String slug;
    public String title;
    public String metaDescription;
    public List<String> h1s;
    public List<String> h2s;
    public int imageCount;
    public int missingAltCount;
    public String canonicalUrl;
    public int wordCount;
    public int internalLinkCount;
    public List<String> schemaTypes;
    public String authorName;
    public String datePublished;
    public String dateModified;
    public String bodyText;
    public String baseDomain;
    public List<String> imagesWithMissingAlt;

    // geo-rules objective metrics
    public int validSchemaFields;
    public int totalSchemaFields;
    public int externalLinkCount;
    public int quotationCount;
    public int factualStatementCount;
    public int totalSentences;
    public int headingCount;
    public int listCount;
    public double avgChunkSize;
    public int technicalTermCount;
    public int totalWords;
    public Integer daysSinceLastUpdate;
}
