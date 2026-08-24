use thiserror::Error;

#[derive(Error, Debug)]
pub enum DencError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Invalid magic bytes in header. Expected 'DENC', found {0:?}")]
    InvalidMagic([u8; 4]),

    #[error("Unsupported format version: {0}. Supported versions: 1")]
    UnsupportedVersion(u16),

    #[error("Unsupported cipher ID: {0}")]
    UnsupportedCipher(u8),

    #[error("Unsupported KDF ID: {0}")]
    UnsupportedKdf(u8),

    #[error("Invalid threshold parameters: threshold {threshold} must be <= total shares {total} and >= 1")]
    InvalidThreshold { threshold: u8, total: u8 },

    #[error("Insufficient shares for quorum: provided {provided}, required {required}")]
    InsufficientShares { provided: usize, required: u8 },

    #[error("Duplicate share ID detected: {0}")]
    DuplicateShare(u8),

    #[error("Invalid share coordinate: {0} (must be between 1 and 255)")]
    InvalidShareCoordinate(u8),

    #[error("Mismatched share lengths: expected {expected}, got {actual}")]
    MismatchedShareLength { expected: usize, actual: usize },

    #[error("AEAD integrity check failed: ciphertext chunk was modified, truncated, or incorrect keys")]
    IntegrityCheckFailed,

    #[error("Stream terminated unexpectedly without final chunk marker")]
    PrematureStreamEnd,

    #[error("KDF error: {0}")]
    KdfError(String),

    #[error("JSON serialization error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("Operation cancelled by user")]
    Cancelled,

    #[error("Custodian share {custodian_id} is time-locked until timestamp {unlock_time} (current time: {current_time})")]
    TimelockActive {
        custodian_id: u8,
        unlock_time: u64,
        current_time: u64,
    },

    #[error("General error: {0}")]
    Custom(String),
}
