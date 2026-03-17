'use client';

import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { WorkflowTrigger } from '@/types';

interface TriggerConfigProps {
    trigger: WorkflowTrigger;
    setTrigger: (trigger: WorkflowTrigger) => void;
    agentId: string;
    setAgentId: (agentId: string) => void;
    agents: { id: string; name: string }[];
}

export function TriggerConfig({ trigger, setTrigger, agentId, setAgentId, agents }: TriggerConfigProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
                <Label htmlFor="trigger-event">Trigger Event</Label>
                <Select value={trigger} onValueChange={(v: string) => setTrigger(v as WorkflowTrigger)}>
                    <SelectTrigger id="trigger-event">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="call_ended">When Call Ends</SelectItem>
                        <SelectItem value="call_started">When Call Starts</SelectItem>
                        <SelectItem value="inbound_call_started">When Inbound Call Starts</SelectItem>
                        <SelectItem value="inbound_call_ended">When Inbound Call Ends</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="agent">Agent</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                    <SelectTrigger id="agent">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Agents</SelectItem>
                        {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                                {agent.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
