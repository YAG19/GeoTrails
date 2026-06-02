package com.geotrail.rag.service;

import com.geotrail.rag.embedding.EmbeddingProvider;
import com.geotrail.rag.llm.LlmProvider;
import com.geotrail.rag.repository.TimelineEmbeddingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Core RAG query handler: embed the question, vector-search the user's timeline,
 * filter weak matches, and ask Claude to answer using only the retrieved records.
 */
@Service
public class TimelineQueryService {

    private static final Logger log = LoggerFactory.getLogger(TimelineQueryService.class);

    private static final String NO_DATA =
            "I don't have enough location data to answer that question.";

    private final EmbeddingProvider embeddingProvider;
    private final TimelineEmbeddingRepository repository;
    private final LlmProvider llmProvider;
    private final QuestionDateExtractor dateExtractor;
    private final int topK;
    private final double minSimilarity;
    private final int maxContextChars;

    public TimelineQueryService(EmbeddingProvider embeddingProvider,
                                TimelineEmbeddingRepository repository,
                                LlmProvider llmProvider,
                                QuestionDateExtractor dateExtractor,
                                @Value("${geotrail.rag.top-k:15}") int topK,
                                @Value("${geotrail.rag.min-similarity:0.4}") double minSimilarity,
                                @Value("${geotrail.rag.max-context-chars:3000}") int maxContextChars) {
        this.embeddingProvider = embeddingProvider;
        this.repository = repository;
        this.llmProvider = llmProvider;
        this.dateExtractor = dateExtractor;
        this.topK = topK;
        this.minSimilarity = minSimilarity;
        this.maxContextChars = maxContextChars;
    }

    public QueryResult query(Long userId, String userQuestion, String model, Double temperature) {
        float[] questionVector = embeddingProvider.embed(userQuestion);

        // If the question names a specific date, scope retrieval to that day so a full
        // day's segments are returned instead of competing against every other date.
        LocalDate dateFilter = dateExtractor.extract(userQuestion);
        if (dateFilter != null) {
            log.info("RAG query for user {} scoped to date {}", userId, dateFilter);
        }

        List<TimelineEmbeddingRepository.EmbeddingMatch> matches =
                repository.findSimilar(userId, questionVector, dateFilter, topK).stream()
                        .filter(m -> m.similarity() >= minSimilarity)
                        .toList();

        if (matches.isEmpty()) {
            return new QueryResult(NO_DATA, List.of(), new double[0]);
        }

        List<String> sources = new ArrayList<>(matches.size());
        double[] scores = new double[matches.size()];
        StringBuilder context = new StringBuilder();
        for (int i = 0; i < matches.size(); i++) {
            var m = matches.get(i);
            sources.add(m.summary());
            scores[i] = m.similarity();
            if (context.length() + m.summary().length() + 1 <= maxContextChars) {
                context.append(m.summary()).append('\n');
            }
        }

        String systemPrompt = llmProvider.systemPromptTemplate().formatted(context.toString().trim());
        String answer = llmProvider.complete(systemPrompt, userQuestion, model, temperature);
        log.info("RAG query for user {} matched {} records", userId, matches.size());
        return new QueryResult(answer, sources, scores);
    }

    public record QueryResult(String answer, List<String> sourceSummaries, double[] scores) {
    }
}
