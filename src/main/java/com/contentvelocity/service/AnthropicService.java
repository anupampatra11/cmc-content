package com.contentvelocity.service;

import com.contentvelocity.model.AiScores;
import com.contentvelocity.model.PageData;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;

@Service
public class AnthropicService {

    private static final Logger log = Logger.getLogger(AnthropicService.class.getName());

    @Value("${anthropic.api.key}")
    private String apiKey;

    @Value("${anthropic.api.url}")
    private String apiUrl;

    @Value("${anthropic.model}")
    private String model;

    private final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build();

    private final ObjectMapper mapper = new ObjectMapper();

    private String systemPrompt;

    @PostConstruct
    void loadPrompt() throws Exception {
        try (InputStream is = getClass().getClassLoader().getResourceAsStream("geo-rules-prompt.txt")) {
            if (is != null) {
                systemPrompt = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            } else {
                log.warning("geo-rules-prompt.txt not found on classpath; using fallback prompt");
                systemPrompt = "Analyze the content and return ONLY valid JSON with objective and subjective GEO metrics.";
            }
        }
    }

    public AiScores analyse(PageData page) {
        String prompt = buildPrompt(page);
        String requestBody = buildRequestBody(prompt);

        try {
            Request request = new Request.Builder()
                    .url(apiUrl)
                    .post(RequestBody.create(requestBody, MediaType.parse("application/json")))
                    .addHeader("x-api-key", apiKey)
                    .addHeader("anthropic-version", "2023-06-01")
                    .addHeader("content-type", "application/json")
                    .build();

            try (Response response = client.newCall(request).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    log.warning("Anthropic API error: " + response.code() + " for " + page.url);
                    return null;
                }

                String body = response.body().string();
                JsonNode root = mapper.readTree(body);
                JsonNode content = root.path("content");

                if (!content.isEmpty()) {
                    String text = content.get(0).path("text").asText();
                    // Strip any markdown code fences if present
                    text = text.replace("```json", "").replace("```", "").trim();

                    // Find the JSON object within the response
                    int start = text.indexOf('{');
                    int end = text.lastIndexOf('}');
                    if (start >= 0 && end > start) {
                        text = text.substring(start, end + 1);
                    }

                    JsonNode responseJson = mapper.readTree(text);

                    // Navigate to subjective node; fall back to root if missing
                    JsonNode subjectiveNode = responseJson.path("subjective");
                    AiScores scores = mapper.treeToValue(
                        subjectiveNode.isMissingNode() ? responseJson : subjectiveNode,
                        AiScores.class);

                    // Extract root-level fields
                    JsonNode suggestionsNode = responseJson.path("top_suggestions");
                    if (suggestionsNode.isArray()) {
                        List<String> suggestions = new ArrayList<>();
                        suggestionsNode.forEach(n -> suggestions.add(n.asText()));
                        scores.topSuggestions = suggestions;
                    }
                    JsonNode summaryNode = responseJson.path("geo_summary");
                    if (!summaryNode.isMissingNode()) {
                        scores.geoSummary = summaryNode.asText();
                    }

                    return scores;
                }
            }
        } catch (Exception e) {
            log.warning("AI analysis failed for " + page.url + ": " + e.getMessage());
        }
        return null;
    }

    private String buildPrompt(PageData page) {
        return systemPrompt + "\n\n---\nINPUT CONTENT:\n\n" +
               "URL: " + page.url + "\n" +
               "Title: " + safe(page.title) + "\n" +
               "Meta description: " + (safe(page.metaDescription).isEmpty() ? "MISSING" : page.metaDescription) + "\n" +
               "Author: " + (safe(page.authorName).isEmpty() ? "MISSING" : page.authorName) + "\n" +
               "Schema types: " + (page.schemaTypes == null || page.schemaTypes.isEmpty() ? "NONE" : String.join(", ", page.schemaTypes)) + "\n" +
               "Body text:\n" + safe(page.bodyText);
    }

    private String buildRequestBody(String prompt) {
        try {
            return mapper.writeValueAsString(new java.util.HashMap<>() {{
                put("model", model);
                put("max_tokens", 2048);
                put("messages", new Object[]{
                    new java.util.HashMap<>() {{
                        put("role", "user");
                        put("content", prompt);
                    }}
                });
            }});
        } catch (Exception e) {
            return "{\"model\":\"" + model + "\",\"max_tokens\":2048,\"messages\":[{\"role\":\"user\",\"content\":\"" + prompt.replace("\"", "\\\"").replace("\n", "\\n") + "\"}]}";
        }
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }
}
