import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
    tenant_id: {
        type: String,
        required: true,
        index: true
    },
    action: {
        type: String,
        required: true,
        enum: [
            'MANAGER_CREATED',
            'MANAGER_UPDATED',
            'MANAGER_PASSWORD_RESET',
            'EMPLOYEE_CREATED',
            'EMPLOYEE_BULK_UPLOADED',
            'EMPLOYEE_UPDATED',
            'EMPLOYEE_DELETED',
            'EMPLOYEE_PASSWORD_RESET',
        ]
    },
    performed_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    performed_by_name: {
        type: String,
        default: ''
    },
    performed_by_role: {
        type: String,
        default: ''
    },
    target_type: {
        type: String,
        enum: ['MANAGER', 'EMPLOYEE'],
        required: true
    },
    target_name: {
        type: String,
        default: ''
    },
    target_email: {
        type: String,
        default: ''
    },
    details: {
        type: String,
        default: ''
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

activityLogSchema.index({ tenant_id: 1, createdAt: -1 });
activityLogSchema.index({ performed_by: 1, tenant_id: 1 });

export default mongoose.model('ActivityLog', activityLogSchema);
