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
        end: "20:10",
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
  onDeleteSchedule,
  onGeneratePlan,
  hasAcceptedSchedule = false,
  hasUnsavedChanges = false,
}) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editError, setEditError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [reflowedBlocks, setReflowedBlocks] = useState(new Set());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [workingPlan, setWorkingPlan] = useState(null); // Temporary copy for edits

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Initialize working plan when the sheet opens or plan changes
  useEffect(() => {
    if (open && plan) {
      setWorkingPlan(JSON.parse(JSON.stringify(plan))); // Deep copy
      setReflowedBlocks(new Set()); // Reset reflow indicators
    }
  }, [open, plan]);

  const isBlockCurrent = useCallback(
    (block) => {
      if (!workingPlan) return false;

      const now = currentTime.getHours() * 60 + currentTime.getMinutes();
      const blockStart = parseTime(block.start);
      const blockEnd = parseTime(block.end);

      if (now >= blockStart && now < blockEnd) {
        return true;
      }

      const allBlockStarts = workingPlan.blocks.map((b) => parseTime(b.start));
      const earliestStart = Math.min(...allBlockStarts);

      if (now < earliestStart && blockStart === earliestStart) {
        return true;
      }

      return false;
    },
    [currentTime, workingPlan],
  );

  // Validate blocks - only structural issues that shouldn't happen with proper editing/generation
  const validateBlocks = useCallback((blocks) => {
    const errors = {};

    blocks.forEach((block, index) => {
      // Check for overlaps (this should never happen with proper data)
      if (index < blocks.length - 1) {
        const nextBlock = blocks[index + 1];
        if (parseTime(block.end) > parseTime(nextBlock.start)) {
          errors[index] = "Blocks cannot overlap";
        }
      }

      // Check for missing or invalid time data (this should never happen with proper data)
      if (!block.start || !block.end) {
        errors[index] = "Invalid time data";
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, []);

  useEffect(() => {
    if (workingPlan?.blocks) {
      validateBlocks(workingPlan.blocks);
    }
  }, [workingPlan, validateBlocks]);

  const validateTimeInterval = (startTime, endTime, blockType = "drive") => {
    if (!startTime || !endTime) return "";
    
    const startMinutes = parseTime(startTime);
    const endMinutes = parseTime(endTime);
    
    // Check if end time is before start time (invalid)
    if (endMinutes <= startMinutes) {
      return "End time must be after start time";
    }
    
    // Calculate duration
    const duration = endMinutes - startMinutes;
    
    // Additional validation for drive blocks
    if (blockType === "drive") {
      if (duration > 120) {
        return "Drive blocks cannot exceed 120 minutes";
      }
    }
    
    // Additional validation for break blocks
    if (blockType === "break") {
      if (duration < 10) {
        return "Break duration must be at least 10 minutes";
      }
    }
    
    return "";
  };

  const handleEditStart = (index, block) => {
    setEditingIndex(index);
    setEditStart(block.start);
    setEditEnd(block.end);
    setEditError(""); // Clear any previous edit errors
    
    // Run initial validation in case the current values are already invalid
    const initialError = validateTimeInterval(block.start, block.end, block.type);
    if (initialError) {
      setEditError(initialError);
    }
  };

  const handleStartTimeChange = (newStart) => {
    setEditStart(newStart);
    if (editingIndex !== null && workingPlan) {
      const block = workingPlan.blocks[editingIndex];
      const intervalError = validateTimeInterval(newStart, editEnd, block.type);
      setEditError(intervalError);
    }
  };

  const handleEndTimeChange = (newEnd) => {
    setEditEnd(newEnd);
    if (editingIndex !== null && workingPlan) {
      const block = workingPlan.blocks[editingIndex];
      const intervalError = validateTimeInterval(editStart, newEnd, block.type);
      setEditError(intervalError);
    }
  };

  const adjustBreakDurations = useCallback((blocks, changedIndex) => {
    const adjustedBlocks = [...blocks];
    
    // Adjust break after the changed drive block
    if (changedIndex < adjustedBlocks.length - 1) {
      const nextBlock = adjustedBlocks[changedIndex + 1];
      if (nextBlock.type === "break") {
        nextBlock.start = adjustedBlocks[changedIndex].end;
        
        // If there's a block after the break, adjust break end
        if (changedIndex + 2 < adjustedBlocks.length) {
          const blockAfterBreak = adjustedBlocks[changedIndex + 2];
          const availableTime = parseTime(blockAfterBreak.start) - parseTime(nextBlock.start);
          
          // Ensure minimum 10 minutes for break
          if (availableTime >= 10) {
            nextBlock.end = blockAfterBreak.start;
          } else {
            // If not enough space, adjust the next drive block start time
            const newStartTime = parseTime(nextBlock.start) + 10;
            blockAfterBreak.start = formatTime(newStartTime);
            nextBlock.end = formatTime(newStartTime);
          }
        }
      }
    }
    
    // Adjust break before the changed drive block
    if (changedIndex > 0) {
      const prevBlock = adjustedBlocks[changedIndex - 1];
      if (prevBlock.type === "break") {
        prevBlock.end = adjustedBlocks[changedIndex].start;
        
        // Ensure minimum duration
        const breakDuration = getDuration(prevBlock.start, prevBlock.end);
        if (breakDuration < 10) {
          const newStartTime = parseTime(prevBlock.end) - 10;
          prevBlock.start = formatTime(newStartTime);
          
          // Adjust previous drive block if needed
          if (changedIndex - 2 >= 0) {
            adjustedBlocks[changedIndex - 2].end = prevBlock.start;
          }
        }
      }
    }
    
    return adjustedBlocks;
  }, []);

  const handleEditSave = () => {
    if (editingIndex === null || !workingPlan) return;

    const block = workingPlan.blocks[editingIndex];
    
    // Check for all validation errors using the same function
    const validationError = validateTimeInterval(editStart, editEnd, block.type);
    if (validationError) {
      setEditError(validationError);
      return;
    }

    // Update the block in working plan only
    const updatedBlocks = [...workingPlan.blocks];
    updatedBlocks[editingIndex] = { ...updatedBlocks[editingIndex], start: editStart, end: editEnd };
    
    // Auto-adjust break durations if we edited a drive block
    const finalBlocks = block.type === "drive" 
      ? adjustBreakDurations(updatedBlocks, editingIndex)
      : updatedBlocks;

    // Update the working plan (not the original plan)
    setWorkingPlan({ ...workingPlan, blocks: finalBlocks });
    setEditingIndex(null);
    setEditError(""); // Clear edit error on successful save

    // Check if reflow is needed
    const newReflowed = new Set(reflowedBlocks);
    if (editingIndex < workingPlan.blocks.length - 1) {
      newReflowed.add(editingIndex + 1);
    }
    setReflowedBlocks(newReflowed);
  };

  const handleClose = () => {
    // Reset working plan to discard any unsaved changes
    if (plan) {
      setWorkingPlan(JSON.parse(JSON.stringify(plan)));
    }
    setEditingIndex(null);
    setEditError("");
    setReflowedBlocks(new Set());
    onDismiss?.();
    onOpenChange(false);
  };

  const handleAccept = () => {
    if (!workingPlan) return;
    const isValid = validateBlocks(workingPlan.blocks);
    if (!isValid) {
      alert("Please fix validation errors before accepting");
      return;
    }
    onAccept?.(workingPlan);
    onOpenChange(false);
  };

  if (!open) return null;

  if (!workingPlan) {
    return null; // Don't show anything if no plan - this shouldn't happen now
  }

  const weekday = getWeekday(workingPlan.day);
  const firstBlockStart = workingPlan.blocks[0]?.start || "00:00";
  const hasErrors = Object.keys(validationErrors).length > 0;
  
  // Check if working plan differs from original plan
  const hasLocalChanges = plan && JSON.stringify(workingPlan.blocks) !== JSON.stringify(plan.blocks);

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
            {workingPlan.blocks.map((block, index) => {
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
            {workingPlan.blocks.map((block, index) => {
              const isEditing = editingIndex === index;
              const error = validationErrors[index];
              const isReflowed = reflowedBlocks.has(index);
              const isCurrent = isBlockCurrent(block);

              return (
                <div key={index}>
                  <div
                    className={cn(
                      "block-card",
                      block.type === "break" ? "block-break" : "",
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
                                onChange={(e) => handleStartTimeChange(e.target.value)}
                                className="time-input"
                                step="300"
                              />
                              <span className="time-separator">–</span>
                              <input
                                type="time"
                                value={editEnd}
                                onChange={(e) => handleEndTimeChange(e.target.value)}
                                className="time-input"
                                step="300"
                              />
                              <button
                                onClick={handleEditSave}
                                disabled={!!editError}
                                className="save-btn"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingIndex(null);
                                  setEditError(""); // Clear error on cancel
                                }}
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

                        {/* Edit error display */}
                        {isEditing && editError && (
                          <p className="error-text edit-error">{editError}</p>
                        )}

                        {block.type === "drive" && (
                          <div className="drive-details">
                            <span className="drive-reason">{block.reason}</span>
                            <span className="separator">•</span>
                            <span className="drive-earning">~€{block.est_eph.toFixed(1)}/hr est.</span>
                          </div>
                        )}

                        {block.type === "break" && (
                          <div className="break-details">
                            <div className="break-auto-info">Auto-adjusted between drive blocks</div>
                          </div>
                        )}

                        {error && <p className="error-text">{error}</p>}
                      </div>

                      {/* Right Column - Actions */}
                      <div className="block-actions">
                        {block.type === "drive" && (
                          <button
                            onClick={() => handleEditStart(index, block)}
                            className="action-btn"
                            aria-label="Edit"
                          >
                            ✏️
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
            <p className="footer-text">Drive ≤120m • Default 15m break</p>
            <div className="footer-actions">
              {!hasAcceptedSchedule && (
                <button
                  onClick={handleClose}
                  className="footer-btn footer-btn-ghost"
                >
                  No thanks
                </button>
              )}
              {hasAcceptedSchedule && (
                <button
                  onClick={() => onDeleteSchedule?.()}
                  className="footer-btn footer-btn-delete"
                >
                  Delete Schedule
                </button>
              )}
              <button
                onClick={handleAccept}
                disabled={hasAcceptedSchedule ? (!(hasUnsavedChanges || hasLocalChanges) || hasErrors) : hasErrors}
                className="footer-btn footer-btn-primary"
              >
                {hasAcceptedSchedule ? "Save Changes" : `Accept Plan & Start at ${firstBlockStart}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}