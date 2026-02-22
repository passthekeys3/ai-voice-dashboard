/**
 * Call Transfer Support
 *
 * Manages call transfer metadata and logging for Retell's transfer_call
 * function capability. The actual transfer is handled by Retell's infrastructure;
 * our system provides transfer targets as dynamic variables and logs the events.
 */

export interface TransferTarget {
    name: string;
    phoneNumber: string;
    extension?: string;
    department?: string;
    availability?: {
        timezone: string;
        startHour: number;
        endHour: number;
    };
}

export interface TransferEvent {
    callId: string;
    agentId: string;
    fromNumber?: string;
    toNumber?: string;
    transferTarget: TransferTarget;
    reason?: string;
    timestamp: string;
}

/**
 * Build transfer target metadata for Retell dynamic variables.
 *
 * Returns a map of transfer targets that can be injected into the
 * agent's configuration when a call starts. The AI agent can then
 * use these to decide who to transfer to.
 */
export function buildTransferTargets(
    targets: TransferTarget[],
): Record<string, string> {
    const metadata: Record<string, string> = {};

    metadata.transfer_targets = JSON.stringify(
        targets.map(t => ({
            name: t.name,
            phone: t.phoneNumber,
            department: t.department,
        })),
    );

    // Also provide as individual keys for simpler agent prompts
    for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        metadata[`transfer_${i}_name`] = t.name;
        metadata[`transfer_${i}_phone`] = t.phoneNumber;
        if (t.department) {
            metadata[`transfer_${i}_department`] = t.department;
        }
    }

    return metadata;
}

/**
 * Log a transfer event and optionally update GHL contact.
 */
export async function logTransferEvent(
    event: TransferEvent,
    ghlConfig?: { apiKey: string; locationId: string },
    hubspotConfig?: { accessToken: string },
): Promise<void> {
    console.log(`Call ${event.callId} transferred to ${event.transferTarget.name}`);

    // Update GHL contact with transfer info if configured
    if (ghlConfig?.apiKey && event.fromNumber) {
        try {
            const { searchContactByPhone, addNoteToContact, updateContactTags } = await import('@/lib/integrations/ghl');

            const contact = await searchContactByPhone(ghlConfig, event.fromNumber);

            if (contact) {
                // Add transfer note
                const noteBody = [
                    `Call transferred to ${event.transferTarget.name}`,
                    event.transferTarget.department ? `Department: ${event.transferTarget.department}` : '',
                    event.reason ? `Reason: ${event.reason}` : '',
                    `Transfer Number: ${event.transferTarget.phoneNumber}`,
                    `Time: ${event.timestamp}`,
                ].filter(Boolean).join('\n');

                await addNoteToContact(ghlConfig, contact.id, noteBody);

                // Add transfer tag
                const existingTags = contact.tags || [];
                await updateContactTags(
                    ghlConfig,
                    contact.id,
                    [...new Set([...existingTags, 'call-transferred'])],
                );
            }
        } catch (err) {
            console.error('Failed to update GHL contact after transfer:', err instanceof Error ? err.message : 'Unknown error');
        }
    }

    // Update HubSpot contact with transfer info if configured
    if (hubspotConfig?.accessToken && event.fromNumber) {
        try {
            const { searchContactByPhone, addNoteToContact, updateContactTags } = await import('@/lib/integrations/hubspot');

            const contact = await searchContactByPhone(hubspotConfig, event.fromNumber);

            if (contact) {
                const noteBody = [
                    `Call transferred to ${event.transferTarget.name}`,
                    event.transferTarget.department ? `Department: ${event.transferTarget.department}` : '',
                    event.reason ? `Reason: ${event.reason}` : '',
                    `Transfer Number: ${event.transferTarget.phoneNumber}`,
                    `Time: ${event.timestamp}`,
                ].filter(Boolean).join('\n');

                await addNoteToContact(hubspotConfig, contact.id, noteBody);

                // Add transfer tag via semicolon-separated ai_call_tags property
                await updateContactTags(hubspotConfig, contact.id, ['call-transferred']);
            }
        } catch (err) {
            console.error('Failed to update HubSpot contact after transfer:', err instanceof Error ? err.message : 'Unknown error');
        }
    }
}
