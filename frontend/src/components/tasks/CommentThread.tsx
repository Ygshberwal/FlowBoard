import { useState, KeyboardEvent } from "react";
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["task", task.id] }); setBody(""); },
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && body.trim()) addComment.mutate(body.trim());
  };

  return (
    <div>
      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
        Comments · {task.comments.length}
      </label>

      <div className="space-y-2 max-h-36 overflow-y-auto mb-2">
        {task.comments.length === 0 ? (
          <p className="text-[10px] text-slate-400 italic">No comments yet</p>
        ) : (
          task.comments.map((c) => (
            <div key={c.id} className="flex gap-1.5">
              <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold ${getColor(c.author_name)}`}>
                {getInitials(c.author_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-200">{c.author_name}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{format(parseISO(c.created_at), "MMM d, h:mm a")}</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-300 mt-0.5 break-words">{c.body}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-md px-2 py-1.5">
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Comment… Enter to post"
          className="flex-1 bg-transparent text-[10px] text-slate-600 dark:text-slate-200 placeholder-slate-400 outline-none"
        />
        {addComment.isPending && <span className="text-[10px] text-slate-400">…</span>}
      </div>
    </div>
  );
}
