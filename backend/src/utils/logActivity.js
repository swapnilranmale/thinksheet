import ActivityLog from '../models/ActivityLog.js';

/**
 * Log an activity. Fire-and-forget — does not throw on failure.
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.action
 * @param {object} params.performedBy - { _id, full_name, role }
 * @param {string} params.targetType - 'MANAGER' | 'EMPLOYEE'
 * @param {string} [params.targetName]
 * @param {string} [params.targetEmail]
 * @param {string} [params.details]
 * @param {object} [params.metadata]
 */
export async function logActivity({
    tenantId,
    action,
    performedBy,
    targetType,
    targetName = '',
    targetEmail = '',
    details = '',
    metadata = {}
}) {
    try {
        await ActivityLog.create({
            tenant_id: tenantId,
            action,
            performed_by: performedBy._id,
            performed_by_name: performedBy.full_name || '',
            performed_by_role: performedBy.role || '',
            target_type: targetType,
            target_name: targetName,
            target_email: targetEmail,
            details,
            metadata
        });
    } catch (err) {
        console.error('[ActivityLog] Failed to log:', err.message);
    }
}
