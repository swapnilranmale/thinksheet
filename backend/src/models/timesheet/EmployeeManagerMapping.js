import mongoose from 'mongoose';

const employeeManagerMappingSchema = new mongoose.Schema({
    tenant_id: {
        type: String,
        required: true,
        index: true
    },
    project_id: {
        type: mongoose.Schema.Types.Mixed, // Streamline ObjectId stored as string
        required: true,
        index: true
    },
    project_name: { type: String, default: '' },
    project_code: { type: String, default: '' },
    manager_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null          // Optional — admin assigns manually, or auto-matched during Streamline sync
    },
    employee_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    // Client Master data (populated from Streamline Resource Master sync)
    client_id: { type: String, default: null },
    client_name: { type: String, default: '' },
    // Resource Intimation dates (populated from Streamline Resource Master sync)
    resource_start_date: { type: Date, default: null },
    resource_end_date: { type: Date, default: null },
    // Sync tracking
    synced_from_streamline: { type: Boolean, default: false },
    synced_at: { type: Date, default: null },
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
