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
