import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
    tenant_id: {
        type: String,
        required: true,
        default: 'default',
        index: true
    },
    employee_name: {
        type: String,
        required: true,
        trim: true
    },
    official_email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    unique_id: {
        type: String,
        required: true,
        trim: true
    },
    designation: {
        type: String,
        default: ''
    },
    department_id: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    team_id: {
        type: String,
        default: null
    },
    team_name: {
        type: String,
        default: ''
    },
    // Streamline360 Resource Master fields
    profile_resource: {
        type: String,
        default: ''
    },
    actual_resource: {
        type: String,
        default: ''
    },
    resource_id: {
        type: String,
        default: ''
    },
    synced_from_streamline: {
        type: Boolean,
        default: false
    },
    is_engineering_manager: {
        type: Boolean,
        default: false
    },
    // Set to true when admin/manager edits this record locally.
    // Prevents Streamline sync from overwriting user-editable fields.
    locally_modified: {
        type: Boolean,
        default: false
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

// Unique email per tenant (for User auth/lookup)
employeeSchema.index({ official_email: 1, tenant_id: 1 }, { unique: true });
// Unique Streamline employee code per tenant (for Streamline sync to prevent duplicates)
employeeSchema.index({ unique_id: 1, tenant_id: 1 }, { unique: true });

export default mongoose.model('Employee', employeeSchema);
