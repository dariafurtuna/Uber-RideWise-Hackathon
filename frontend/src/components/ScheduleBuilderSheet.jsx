import React, { useState, useEffect, useCallback } from "react";
import { cn } from "../utils/cn";
import "/styles/ScheduleBuilderSheet.css";

// Data types
export const DriveBlock = {
  type: "drive",
  start: "", // HH:MM
  end: "", // HH:MM  
  reason: "",
  est_eph: 0
};

export const BreakBlock = {
  type: "break",
  start: "", // HH:MM
  end: "", // HH:MM
  nearby: []
};

// Utility functions
function parseTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getDuration(start, end) {
  return parseTime(end) - parseTime(start);
}

function getWeekday(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

// Mock data generator for demo
function generateMockPlan() {
  const today = new Date().toISOString().split('T')[0];
  return {
    day: today,
    blocks: [
      {
        type: "drive",
        start: "16:00",
        end: "18:00",
        reason: "dinner pre-peak",
        est_eph: 24.5
      },
      {
        type: "break",
        start: "18:00",
        end: "18:15",
        nearby: [
          { name: "Cafe Azul", dist_km: 0.6 },
          { name: "P+R Centrum", dist_km: 0.9 }
        ]
      },
      {
        type: "drive",
        start: "18:15",
        end: "21:00",
        reason: "dinner peak",
        est_eph: 29.1
      }
    ]
  };
}

export function ScheduleBuilderSheet({
  open,
  onOpenChange,
  plan,
  onAccept,
  onEdit,
  onAddBreak,
  onRemove,
  onDismiss,
  onGeneratePlan,
}) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [reflowedBlocks, setReflowedBlocks] = useState(new Set());
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const isBlockCurrent = useCallback(
    (block) => {
      if (!plan) return false;

      const now = currentTime.getHours() * 60 + currentTime.getMinutes();
      const blockStart = parseTime(block.start);
      const blockEnd = parseTime(block.end);

      if (now >= blockStart && now < blockEnd) {
        return true;
      }

      const allBlockStarts = plan.blocks.map((b) => parseTime(b.start));
      const earliestStart = Math.min(...allBlockStarts);

      if (now < earliestStart && blockStart === earliestStart) {
        return true;
      }

      return false;
    },
    [currentTime, plan],
  );

  // Validate blocks
  const validateBlocks = useCallback((blocks) => {
    const errors = {};

    blocks.forEach((block, index) => {
      if (block.type === "drive") {
        const duration = getDuration(block.start, block.end);
        if (duration > 120) {
          errors[index] = "Drive blocks cannot exceed 120 minutes";
        }

        // Check if next block is a break if this drive is at limit
        if (duration >= 120 && index < blocks.length - 1) {
          const nextBlock = blocks[index + 1];
          if (nextBlock.type !== "break") {
            errors[index] = "Drive blocks ≥120 min must be followed by a break";
          }
        }
      }

      if (block.type === "break") {
        const duration = getDuration(block.start, block.end);
        if (duration < 10 || duration > 30) {
          errors[index] = "Break duration must be 10-30 minutes";
        }
      }

      // Check for overlaps
      if (index < blocks.length - 1) {
        const nextBlock = blocks[index + 1];
        if (parseTime(block.end) > parseTime(nextBlock.start)) {
          errors[index] = "Blocks cannot overlap";
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, []);

  useEffect(() => {
    if (plan?.blocks) {
      validateBlocks(plan.blocks);
    }
  }, [plan, validateBlocks]);

  const handleEditStart = (index, block) => {
    setEditingIndex(index);
    setEditStart(block.start);
    setEditEnd(block.end);
  };

  const handleEditSave = () => {
    if (editingIndex === null || !plan) return;

    const duration = getDuration(editStart, editEnd);
    const block = plan.blocks[editingIndex];

    // Validate duration constraints
    if (block.type === "drive" && duration > 120) {
      alert("Drive blocks cannot exceed 120 minutes");
      return;
    }

    if (block.type === "break" && (duration < 10 || duration > 30)) {
      alert("Break duration must be 10-30 minutes");
      return;
    }

    onEdit?.(editingIndex, { start: editStart, end: editEnd });
    setEditingIndex(null);

    // Check if reflow is needed
    const newReflowed = new Set(reflowedBlocks);
    if (editingIndex < plan.blocks.length - 1) {
      newReflowed.add(editingIndex + 1);
    }
    setReflowedBlocks(newReflowed);
  };

  const handleClose = () => {
    onDismiss?.();
    onOpenChange(false);
  };

  const handleAccept = () => {
    if (!plan) return;
    const isValid = validateBlocks(plan.blocks);
    if (!isValid) {
      alert("Please fix validation errors before accepting");
      return;
    }
    onAccept?.(plan);
    onOpenChange(false);
  };

  if (!open) return null;

  if (!plan) {
    return null; // Don't show anything if no plan - this shouldn't happen now
  }

  const weekday = getWeekday(plan.day);
  const firstBlockStart = plan.blocks[0]?.start || "00:00";
  const hasErrors = Object.keys(validationErrors).length > 0;

  return (
    <div className="schedule-sheet-overlay">
      <div className="schedule-sheet">
        {/* Header */}
        <div className="schedule-header">
          <div className="header-content">
            <div>
              <h2 className="schedule-title">Smart Plan for {weekday}</h2>
              <p className="schedule-subtitle">Based on today's demand & traffic</p>
            </div>
            <button
              onClick={handleClose}
              className="close-btn"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Plan Summary Pills */}
        <div className="schedule-pills">
          <div className="pills-container">
            {plan.blocks.map((block, index) => {
              const isCurrent = isBlockCurrent(block);
              return (
                <div
                  key={index}
                  className={cn(
                    "pill",
                    isCurrent ? "pill-current" : "pill-default"
                  )}
                >
                  {block.type === "drive" ? "Drive" : "Break"} {block.start}–{block.end}
                </div>
              );
            })}
          </div>
        </div>

        {/* Block List */}
        <div className="schedule-content">
          <div className="blocks-list">
            {plan.blocks.map((block, index) => {
              const isEditing = editingIndex === index;
              const error = validationErrors[index];
              const isReflowed = reflowedBlocks.has(index);
              const isCurrent = isBlockCurrent(block);

              return (
                <div key={index}>
                  <div
                    className={cn(
                      "block-card",
                      error ? "block-error" : isCurrent ? "block-current" : "block-default"
                    )}
                  >
                    <div className="block-content">
                      {/* Left Column */}
                      <div className="block-info">
                        <div className="block-header">
                          <h3 className="block-type">
                            {block.type === "drive" ? "Drive" : "Break"}
                          </h3>
                          {isEditing ? (
                            <div className="edit-controls">
                              <input
                                type="time"
                                value={editStart}
                                onChange={(e) => setEditStart(e.target.value)}
                                className="time-input"
                                step="300"
                              />
                              <span className="time-separator">–</span>
                              <input
                                type="time"
                                value={editEnd}
                                onChange={(e) => setEditEnd(e.target.value)}
                                className="time-input"
                                step="300"
                              />
                              <button
                                onClick={handleEditSave}
                                className="save-btn"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingIndex(null)}
                                className="cancel-btn"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="block-time">
                              {block.start}–{block.end}
                            </span>
                          )}
                          {isReflowed && (
                            <span className="reflowed-badge">
                              Reflowed
                            </span>
                          )}
                        </div>

                        {block.type === "drive" && (
                          <div className="drive-details">
                            <span className="drive-reason">{block.reason}</span>
                            <span className="separator">•</span>
                            <span className="drive-earning">~€{block.est_eph.toFixed(1)}/hr est.</span>
                          </div>
                        )}

                        {block.type === "break" && (
                          <div className="break-details">
                            <div className="break-duration">~{getDuration(block.start, block.end)} min</div>
                            {block.nearby && block.nearby.length > 0 && (
                              <div className="nearby-options">
                                {block.nearby.slice(0, 2).map((option, i) => (
                                  <React.Fragment key={i}>
                                    {i > 0 && <span className="separator">·</span>}
                                    <span>
                                      {option.name} • {option.dist_km} km
                                    </span>
                                  </React.Fragment>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {error && <p className="error-text">{error}</p>}
                      </div>

                      {/* Right Column - Actions */}
                      <div className="block-actions">
                        <button
                          onClick={() => handleEditStart(index, block)}
                          className="action-btn"
                          aria-label="Edit"
                        >
                          ✏️
                        </button>
                        {block.type === "break" && index > 0 && (
                          <button
                            onClick={() => onRemove?.(index)}
                            className="action-btn"
                            aria-label="Delete"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="schedule-footer">
          <div className="footer-content">
            <p className="footer-text">Drive ≤120m • Break 15m defaults • You can edit anytime</p>
            <div className="footer-actions">
              <button
                onClick={handleClose}
                className="footer-btn footer-btn-ghost"
              >
                No thanks
              </button>
              <button
                onClick={() => {}}
                className="footer-btn footer-btn-outline"
              >
                Edit All
              </button>
              <button
                onClick={handleAccept}
                disabled={hasErrors}
                className="footer-btn footer-btn-primary"
              >
                Accept Plan & Start at {firstBlockStart}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}