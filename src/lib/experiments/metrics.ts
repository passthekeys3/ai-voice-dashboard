/**
 * Experiment Metrics Computation
 *
 * Shared logic for computing per-variant metrics from call data.
 * Used by both the API route and the server component to avoid duplication.
 */

export interface CallData {
    duration_seconds?: number;
    sentiment?: string;
    status?: string;
}

export interface VariantMetrics {
    call_count: number;
    avg_duration: number;
    avg_sentiment: number;
    conversion_rate: number;
    confidence?: number; // Statistical confidence level (0-1)
}

/**
 * Compute metrics for a set of calls belonging to a variant.
 */
export function computeVariantMetrics(calls: CallData[]): VariantMetrics {
    if (!calls || calls.length === 0) {
        return {
            call_count: 0,
            avg_duration: 0,
            avg_sentiment: 0,
            conversion_rate: 0,
        };
    }

    const callCount = calls.length;

    const avgDuration = Math.round(
        calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / callCount
    );

    // Sentiment score: positive=1, neutral=0.5, negative=0
    const sentimentScores = calls.map(c => {
        if (c.sentiment === 'positive') return 1;
        if (c.sentiment === 'negative') return 0;
        return 0.5;
    });
    const avgSentiment = Math.round(
        sentimentScores.reduce((sum, s) => sum + s, 0) / sentimentScores.length * 100
    ) / 100;

    // Conversion rate = completed calls / total calls
    const completedCalls = calls.filter(c => c.status === 'completed').length;
    const conversionRate = Math.round((completedCalls / callCount) * 100);

    return {
        call_count: callCount,
        avg_duration: avgDuration,
        avg_sentiment: avgSentiment,
        conversion_rate: conversionRate,
    };
}

/**
 * Two-proportion z-test for statistical significance.
 *
 * Compares two conversion rates to determine if the difference is
 * statistically significant. Returns a confidence level (0-1).
 *
 * For duration and sentiment goals, uses a two-sample t-test approximation.
 */
export function computeSignificance(
    goal: string,
    variantA: { calls: CallData[]; metrics: VariantMetrics },
    variantB: { calls: CallData[]; metrics: VariantMetrics },
): number {
    const nA = variantA.metrics.call_count;
    const nB = variantB.metrics.call_count;

    // Need minimum sample size
    if (nA < 5 || nB < 5) return 0;

    if (goal === 'conversion') {
        // Two-proportion z-test
        const pA = variantA.metrics.conversion_rate / 100;
        const pB = variantB.metrics.conversion_rate / 100;
        const pPooled = (pA * nA + pB * nB) / (nA + nB);

        if (pPooled === 0 || pPooled === 1) return 0;

        const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / nA + 1 / nB));
        if (se === 0) return 0;

        const z = Math.abs(pA - pB) / se;
        return zToConfidence(z);
    }

    if (goal === 'duration') {
        // Two-sample t-test approximation for duration
        const meanA = variantA.metrics.avg_duration;
        const meanB = variantB.metrics.avg_duration;
        const varA = computeVariance(variantA.calls.map(c => c.duration_seconds || 0));
        const varB = computeVariance(variantB.calls.map(c => c.duration_seconds || 0));

        if (varA === 0 && varB === 0) return 0;

        const se = Math.sqrt(varA / nA + varB / nB);
        if (se === 0) return 0;

        const t = Math.abs(meanA - meanB) / se;
        return zToConfidence(t); // Approximate with z for large n
    }

    if (goal === 'sentiment') {
        // Two-sample t-test for sentiment scores
        const scoresA = variantA.calls.map(c => {
            if (c.sentiment === 'positive') return 1;
            if (c.sentiment === 'negative') return 0;
            return 0.5;
        });
        const scoresB = variantB.calls.map(c => {
            if (c.sentiment === 'positive') return 1;
            if (c.sentiment === 'negative') return 0;
            return 0.5;
        });

        const meanA = scoresA.reduce((s, v) => s + v, 0) / nA;
        const meanB = scoresB.reduce((s, v) => s + v, 0) / nB;
        const varA = computeVariance(scoresA);
        const varB = computeVariance(scoresB);

        if (varA === 0 && varB === 0) return 0;

        const se = Math.sqrt(varA / nA + varB / nB);
        if (se === 0) return 0;

        const t = Math.abs(meanA - meanB) / se;
        return zToConfidence(t);
    }

    return 0;
}

function computeVariance(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const sumSquaredDiffs = values.reduce((s, v) => s + (v - mean) ** 2, 0);
    return sumSquaredDiffs / (values.length - 1); // Sample variance
}

/**
 * Convert z-score to approximate confidence level using the error function.
 * Returns value between 0 and 1.
 */
function zToConfidence(z: number): number {
    // Approximate the cumulative normal distribution
    // Using the error function approximation
    const p = 1 - 2 * normalCDF(-Math.abs(z));
    return Math.round(p * 1000) / 1000; // Round to 3 decimal places
}

/**
 * Approximate normal CDF using Abramowitz & Stegun formula 7.1.26
 */
function normalCDF(x: number): number {
    if (x < -8) return 0;
    if (x > 8) return 1;

    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
}
