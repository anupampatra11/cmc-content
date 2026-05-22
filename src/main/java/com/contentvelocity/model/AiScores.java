package com.contentvelocity.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class AiScores {
    @JsonProperty("relevance")
    public double relevance;

    @JsonProperty("authority")
    public double authority;

    @JsonProperty("clarity")
    public double clarity;

    @JsonProperty("conversational_fit")
    public double conversationalFit;

    @JsonProperty("uniqueness")
    public double uniqueness;

    @JsonProperty("engagement")
    public double engagement;

    @JsonProperty("trustworthiness")
    public double trustworthiness;

    @JsonProperty("top_suggestions")
    public List<String> topSuggestions;

    @JsonProperty("geo_summary")
    public String geoSummary;
}
