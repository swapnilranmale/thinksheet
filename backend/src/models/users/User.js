import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const permissionSchema = new mongoose.Schema({
    module_name: { type: String },
    functions: [{ type: String }],
    submodules: [{ type: String }]
}, { _id: false });

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    full_name: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['EMPLOYEE', 'MANAGER', 'ADMINISTRATOR'],
        required: true
    },
    tenant_id: {
        type: String,
        required: true,
        default: 'default'
    },
    is_active: {
        type: Boolean,
        default: true
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    must_change_password: {
        type: Boolean,
        default: false
    },
    employee_ref_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    designation: {
        type: String,
        default: ''
    },
    department_id: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    team_ids: [{
        type: String
    }],
    permissions: {
        module_access: [permissionSchema],
        can_approve_expenses: { type: Boolean, default: false },
        can_create_users: { type: Boolean, default: false },
        approval_limit: { type: Number, default: null }
    }
}, {
    timestamps: true
});

// Unique email per tenant
userSchema.index({ email: 1, tenant_id: 1 }, { unique: true });

// Hash password before save
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Compare password
userSchema.methods.comparePassword = async function (plain) {
    return bcrypt.compare(plain, this.password);
};

export default mongoose.model('User', userSchema);
