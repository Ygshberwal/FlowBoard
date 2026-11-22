import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "../../api/tasks";
import { useAuthStore } from "../../store/authStore";
import type { Task } from "../../types/task";
import { format, parseISO } from "date-fns";

interface Props { task: Task; }

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const COLORS = ["bg-indigo-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-purple-500"];
const getColor = (name: string) => COLORS[name.charCodeAt(0) % COLORS.length];

export default function CommentThread({ task }: Props) {
  const [body, setBody] = useState("");
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const addComment = useMutation({
    mutationFn: (text: string) =>
      tasksApi.addComment(task.id, text, user?.username ?? "You"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task", task.id] }); qc.invalidateQueries({ queryKey: ["board"] }); setBody(""); },
  });

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
        Comments · {task.comments.length}
      </h3>

      <div className="space-y-2 max-h-36 overflow-y-auto mb-2">
        {task.comments.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Add a note or update to keep the context here.</p>
        ) : (
          task.comments.map((c) => (
            <div key={c.id} className="flex gap-1.5">
              <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold ${getColor(c.author_name)}`}>
                {getInitials(c.author_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-200">{c.author_name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{format(parseISO(c.created_at), "MMM d, h:mm a")}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 break-words">{c.body}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={(event) => { event.preventDefault(); if (body.trim() && !addComment.isPending) addComment.mutate(body.trim()); }} className="mt-3 flex items-center gap-2">
        <label className="sr-only" htmlFor={`comment-${task.id}`}>New comment</label>
        <input
          id={`comment-${task.id}`}
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={addComment.isPending}
          placeholder="Write a comment…"
          className="field min-w-0 flex-1"
        />
        <button type="submit" disabled={!body.trim() || addComment.isPending} className="btn-secondary">{addComment.isPending ? "Posting…" : "Post"}</button>
      </form>
      {addComment.isError && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-300">Your comment wasn’t posted. Your draft is still here; please try again.</p>}
    </div>
  );
}
