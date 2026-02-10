/**
 * Conversation Simulator
 *
 * Runs a turn-by-turn simulated conversation between two separate Claude Haiku contexts:
 * 1. Persona context — plays the test caller, sees persona traits + scenario
 * 2. Agent context — uses the agent's real system prompt verbatim
 *
 * Neither context sees the other's system prompt, mirroring real-world conditions.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { TestPersona, TranscriptMessage } from '@/types';

const HAIKU_MODEL = 'claude-haiku-4-20250514';
const MAX_TOKENS_PER_TURN = 256; // Keep responses concise like real speech

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
    if (!anthropicClient) {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY not configured');
        }
        anthropicClient = new Anthropic({ apiKey });
    }
    return anthropicClient;
}

export interface SimulationResult {
    transcript: TranscriptMessage[];
    turnCount: number;
    endReason: 'persona_ended' | 'max_turns' | 'natural_end' | 'error';
    totalInputTokens: number;
    totalOutputTokens: number;
}

function buildPersonaSystemPrompt(persona: TestPersona, scenario: string): string {
    const traits = persona.traits;
    let prompt = `You are role-playing as a phone caller in a simulated conversation. Stay fully in character.

Your persona: ${persona.name}
${persona.description || ''}

Your traits:
- Temperament: ${traits.temperament}
- Communication style: ${traits.communication_style}
- Knowledge level: ${traits.knowledge_level}
- Objection tendency: ${traits.objection_tendency}`;

    if (traits.custom_instructions) {
        prompt += `\n- Special behavior: ${traits.custom_instructions}`;
    }

    prompt += `

Your scenario:
${scenario}

RULES:
- Respond naturally as this persona would on a phone call
- Keep responses concise (1-3 sentences, like real speech)
- Stay in character throughout — do not break the fourth wall
- If your goal in the scenario is achieved OR the conversation naturally concludes, say goodbye and append [END_CALL]
- If the agent is unhelpful after 3-4 attempts, express frustration and end with [END_CALL]
- Do NOT include stage directions, narration, or parenthetical notes
- Output ONLY your spoken words (plus [END_CALL] when ending)`;

    return prompt;
}

export async function simulateConversation(params: {
    agentSystemPrompt: string;
    agentFirstMessage?: string;
    scenario: string;
    persona: TestPersona;
    maxTurns: number;
    onTurn?: (message: TranscriptMessage) => void;
}): Promise<SimulationResult> {
    const { agentSystemPrompt, agentFirstMessage, scenario, persona, maxTurns, onTurn } = params;
    const client = getClient();
    const transcript: TranscriptMessage[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let turn = 0;

    const personaSystemPrompt = buildPersonaSystemPrompt(persona, scenario);

    // Turn 0: Agent's opening message
    let agentOpening: string;
    if (agentFirstMessage) {
        agentOpening = agentFirstMessage;
    } else {
        try {
            const openingResponse = await client.messages.create({
                model: HAIKU_MODEL,
                max_tokens: MAX_TOKENS_PER_TURN,
                system: agentSystemPrompt,
                messages: [{ role: 'user', content: '[A caller has just connected. Deliver your opening greeting.]' }],
            });
            totalInputTokens += openingResponse.usage.input_tokens;
            totalOutputTokens += openingResponse.usage.output_tokens;

            const textBlock = openingResponse.content.find(b => b.type === 'text');
            agentOpening = textBlock && textBlock.type === 'text' ? textBlock.text : 'Hello, how can I help you today?';
        } catch (error) {
            console.error('Simulator: Agent opening failed:', error instanceof Error ? error.message : error);
            return {
                transcript,
                turnCount: 0,
                endReason: 'error',
                totalInputTokens,
                totalOutputTokens,
            };
        }
    }

    const agentMsg: TranscriptMessage = { role: 'agent', content: agentOpening, turn };
    transcript.push(agentMsg);
    onTurn?.(agentMsg);
    turn++;

    // Conversation loop
    // maxTurns represents the max number of conversational exchanges (1 exchange = 1 caller + 1 agent message).
    // So total messages capped at maxTurns * 2 (plus the opening).
    let endReason: SimulationResult['endReason'] = 'max_turns';
    let exchanges = 0;

    while (exchanges < maxTurns) {
        // --- Persona turn ---
        const personaMessages: Anthropic.MessageParam[] = [];
        for (const msg of transcript) {
            if (msg.role === 'agent') {
                personaMessages.push({ role: 'user', content: msg.content });
            } else {
                personaMessages.push({ role: 'assistant', content: msg.content });
            }
        }

        let personaText = '';
        let hasEndCall = false;

        try {
            const personaResponse = await client.messages.create({
                model: HAIKU_MODEL,
                max_tokens: MAX_TOKENS_PER_TURN,
                system: personaSystemPrompt,
                messages: personaMessages,
            });
            totalInputTokens += personaResponse.usage.input_tokens;
            totalOutputTokens += personaResponse.usage.output_tokens;

            const personaTextBlock = personaResponse.content.find(b => b.type === 'text');
            personaText = personaTextBlock && personaTextBlock.type === 'text' ? personaTextBlock.text : '';

            hasEndCall = personaText.includes('[END_CALL]');
            personaText = personaText.replace('[END_CALL]', '').trim();
        } catch (error) {
            console.error(`Simulator: Persona turn ${turn} failed:`, error instanceof Error ? error.message : error);
            endReason = 'error';
            break;
        }

        if (personaText) {
            const callerMsg: TranscriptMessage = { role: 'caller', content: personaText, turn };
            transcript.push(callerMsg);
            onTurn?.(callerMsg);
            turn++;
        }

        if (hasEndCall) {
            endReason = 'persona_ended';
            break;
        }

        if (!personaText) {
            endReason = 'natural_end';
            break;
        }

        // --- Agent turn ---
        const agentMessages: Anthropic.MessageParam[] = [];
        for (const msg of transcript) {
            if (msg.role === 'caller') {
                agentMessages.push({ role: 'user', content: msg.content });
            } else {
                agentMessages.push({ role: 'assistant', content: msg.content });
            }
        }

        try {
            const agentResponse = await client.messages.create({
                model: HAIKU_MODEL,
                max_tokens: MAX_TOKENS_PER_TURN,
                system: agentSystemPrompt,
                messages: agentMessages,
            });
            totalInputTokens += agentResponse.usage.input_tokens;
            totalOutputTokens += agentResponse.usage.output_tokens;

            const agentTextBlock = agentResponse.content.find(b => b.type === 'text');
            const agentText = agentTextBlock && agentTextBlock.type === 'text' ? agentTextBlock.text.trim() : '';

            if (agentText) {
                const agentReply: TranscriptMessage = { role: 'agent', content: agentText, turn };
                transcript.push(agentReply);
                onTurn?.(agentReply);
                turn++;
            }

            if (!agentText) {
                endReason = 'natural_end';
                break;
            }
        } catch (error) {
            console.error(`Simulator: Agent turn ${turn} failed:`, error instanceof Error ? error.message : error);
            endReason = 'error';
            break;
        }

        exchanges++;
    }

    return {
        transcript,
        turnCount: transcript.length,
        endReason,
        totalInputTokens,
        totalOutputTokens,
    };
}
