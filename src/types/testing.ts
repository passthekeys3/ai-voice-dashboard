// Agent Testing Types

export type PersonaTemperament = 'angry' | 'friendly' | 'confused' | 'impatient' | 'skeptical' | 'neutral';
export type CommunicationStyle = 'verbose' | 'terse' | 'rambling' | 'direct' | 'polite';
export type KnowledgeLevel = 'expert' | 'moderate' | 'novice';
export type ObjectionTendency = 'high' | 'medium' | 'low' | 'none';

export interface PersonaTraits {
    temperament: PersonaTemperament;
    communication_style: CommunicationStyle;
    knowledge_level: KnowledgeLevel;
    objection_tendency: ObjectionTendency;
    custom_instructions?: string;
}

export interface TestPersona {
    id: string;
    agency_id: string;
    name: string;
    description?: string;
    traits: PersonaTraits;
    is_preset: boolean;
    created_at: string;
    updated_at: string;
}

export type CriterionType = 'must_pass' | 'should_pass' | 'must_not_fail';

export interface SuccessCriterion {
    criterion: string;
    type: CriterionType;
}

export interface TestCase {
    id: string;
    test_suite_id: string;
    persona_id?: string;
    name: string;
    description?: string;
    scenario: string;
    success_criteria: SuccessCriterion[];
    max_turns: number;
    tags: string[];
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
    // Joined data
    persona?: TestPersona;
}

export interface TestSuite {
    id: string;
    agency_id: string;
    agent_id: string;
    name: string;
    description?: string;
    agent_prompt_snapshot?: string;
    created_at: string;
    updated_at: string;
    // Joined data
    agent?: { name: string };
    test_cases?: TestCase[] | { id: string }[];
    latest_run?: TestRun[];
}

export type TestRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type PromptSource = 'current' | 'custom' | 'experiment_variant';

export interface TestRun {
    id: string;
    agency_id: string;
    test_suite_id: string;
    agent_id: string;
    prompt_tested: string;
    prompt_source: PromptSource;
    experiment_variant_id?: string;
    status: TestRunStatus;
    total_cases: number;
    passed_cases: number;
    failed_cases: number;
    errored_cases: number;
    avg_score?: number;
    started_at?: string;
    completed_at?: string;
    duration_ms?: number;
    total_input_tokens: number;
    total_output_tokens: number;
    estimated_cost_cents: number;
    created_at: string;
    updated_at: string;
    // Joined data
    test_suite?: { name: string };
    test_results?: TestResult[];
}

export type TestResultStatus = 'pending' | 'running' | 'passed' | 'failed' | 'errored';

export interface TranscriptMessage {
    role: 'agent' | 'caller';
    content: string;
    turn: number;
}

export interface CriterionResult {
    criterion: string;
    type: CriterionType;
    passed: boolean;
    reasoning: string;
}

export interface TestResult {
    id: string;
    test_run_id: string;
    test_case_id: string;
    persona_id?: string;
    status: TestResultStatus;
    transcript: TranscriptMessage[];
    turn_count: number;
    criteria_results: CriterionResult[];
    overall_score?: number;
    evaluation_summary?: string;
    sentiment?: string;
    topics: string[];
    started_at?: string;
    completed_at?: string;
    duration_ms?: number;
    input_tokens: number;
    output_tokens: number;
    error_message?: string;
    created_at: string;
    // Joined data
    test_case?: TestCase;
    persona?: TestPersona;
}

// Progress update types for streaming execution
export interface TestProgressUpdate {
    type: 'started' | 'case_started' | 'case_completed' | 'progress' | 'complete' | 'error';
    total?: number;
    completed?: number;
    case_id?: string;
    case_name?: string;
    status?: TestResultStatus;
    score?: number;
    run_id?: string;
    passed?: number;
    failed?: number;
    errored?: number;
    avg_score?: number;
    message?: string;
}
