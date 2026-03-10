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

employeeSchema.index({ official_email: 1, tenant_id: 1 }, { unique: true });
employeeSchema.index({ unique_id: 1, tenant_id: 1 });

export default mongoose.model('Employee', employeeSchema);
