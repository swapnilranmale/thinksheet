import mongoose from 'mongoose';

const employeeManagerMappingSchema = new mongoose.Schema({
    tenant_id: {
        type: String,
        required: true,
        index: true
    },
    project_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProjectMaster',
        required: true,
        index: true
    },
    manager_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    mapped_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    mapped_at: {
        type: Date,
        default: Date.now
    },
    is_active: {
        type: Boolean,
        default: true
    },
    is_deleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// One employee per project per tenant (same employee can be on multiple projects)
employeeManagerMappingSchema.index(
    { employee_id: 1, project_id: 1, tenant_id: 1 },
    { unique: true, partialFilterExpression: { is_deleted: { $ne: true } } }
);

employeeManagerMappingSchema.index({ project_id: 1, tenant_id: 1 });
employeeManagerMappingSchema.index({ manager_id: 1, tenant_id: 1 });
employeeManagerMappingSchema.index({ tenant_id: 1, is_deleted: 1 });

export default mongoose.model('EmployeeManagerMapping', employeeManagerMappingSchema);
