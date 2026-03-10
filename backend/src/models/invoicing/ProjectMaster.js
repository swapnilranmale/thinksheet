import mongoose from 'mongoose';

const projectMasterSchema = new mongoose.Schema({
    tenant_id: {
        type: String,
        required: true,
        default: 'default',
        index: true
    },
    project_name: {
        type: String,
        required: true,
        trim: true
    },
    unique_id: {
        type: String,
        trim: true
    },
    project_status: {
        type: String,
        enum: ['Active', 'Inactive', 'Completed'],
        default: 'Active'
    },
    is_deleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

export default mongoose.model('ProjectMaster', projectMasterSchema);
