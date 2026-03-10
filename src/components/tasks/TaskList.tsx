"use client";

import React, { useState } from "react";
import type { Task } from "@/lib/types";
import TaskItem from "./TaskItem";

interface TaskListProps {
    tasks: Task[];
    onTaskClick: (task: Task) => void;
    onToggleStatus: (task: Task) => void;
    onReorder: (tasks: Task[]) => void;
    viewMode: string;
}

export function TaskList({ tasks, onTaskClick, onToggleStatus, onReorder, viewMode }: TaskListProps) {
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedTaskId(id);
        e.dataTransfer.effectAllowed = "move";
        // Hide standard drag image for custom styling
        if (e.dataTransfer.setDragImage) {
            const dragImage = document.createElement("div");
            e.dataTransfer.setDragImage(dragImage, 0, 0);
        }
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        if (draggedTaskId === id) return;

        const draggedIndex = tasks.findIndex(t => t.id === draggedTaskId);
        const targetIndex = tasks.findIndex(t => t.id === id);

        if (draggedIndex === -1 || targetIndex === -1) return;

        // Optimistically reorder while dragging
        const newTasks = [...tasks];
        const [removed] = newTasks.splice(draggedIndex, 1);
        newTasks.splice(targetIndex, 0, removed);

        // Update their internal order property
        newTasks.forEach((t, i) => t.order = i);

        onReorder(newTasks);
    };

    const handleDragEnd = () => {
        setDraggedTaskId(null);
    };

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm">
                <p>No tasks found for &quot;{viewMode}&quot; view.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            {tasks.map((task) => (
                <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragOver={(e) => handleDragOver(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className={`transition-all ${draggedTaskId === task.id ? 'opacity-50 scale-[0.98]' : 'opacity-100'}`}
                >
                    <TaskItem
                        task={task}
                        onClick={() => onTaskClick(task)}
                        onToggle={() => onToggleStatus(task)}
                    />
                </div>
            ))}
        </div>
    );
}

export default TaskList;
