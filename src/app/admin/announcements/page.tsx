"use client";
import React from "react";
import toast from "react-hot-toast";
import { Megaphone, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/components/utils/api";

const TEMPLATES = [
  { title: "Maintenance soon", message: "We will restart the game in a few minutes. Cash out your bets to stay safe." },
  { title: "Deposits are back", message: "M-Pesa deposits are working normally again. Thanks for your patience." },
  { title: "Play responsibly", message: "Only bet what you can afford to lose. Need a break? Contact support." },
];

export default function AdminAnnouncementsPage() {
  const [title, setTitle] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const send = async () => {
    if (!title.trim() || !message.trim()) return toast.error("Add a title and a message first.");
    if (!window.confirm("Send this popup to every player online right now?")) return;
    setSending(true);
    try {
      await apiRequest("/admin/broadcast", { method: "POST", body: { title: title.trim(), message: message.trim() } });
      toast.success("Announcement sent to everyone online");
      setTitle("");
      setMessage("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Announcements</h1>
        <p className="text-sm text-white/40">Send a live popup to every player who is online right now. It is not saved, so players who are offline won&apos;t see it.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-[#0d1224] border border-white/5 text-white">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Megaphone className="h-4 w-4 text-orange-400" /> New announcement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5">
            <div className="space-y-1.5">
              <Label htmlFor="ann-title" className="text-xs text-white/50">Title</Label>
              <Input id="ann-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Maintenance soon" className="border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ann-msg" className="text-xs text-white/50">Message <span className="text-white/25">({message.length}/300)</span></Label>
              <textarea id="ann-msg" value={message} maxLength={300} rows={4} onChange={(e) => setMessage(e.target.value)} placeholder="What should players know?" className="w-full resize-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus-visible:ring-2 focus-visible:ring-orange-500/50" />
            </div>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button key={t.title} type="button" onClick={() => { setTitle(t.title); setMessage(t.message); }} className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/50 transition-colors hover:bg-white/5 hover:text-white">
                  {t.title}
                </button>
              ))}
            </div>
            <Button onClick={send} disabled={sending} className="w-full border-0 bg-orange-500 text-white hover:bg-orange-600">
              <Send className="mr-2 h-4 w-4" /> {sending ? "Sending…" : "Send to everyone online"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#0d1224] border border-white/5 text-white">
          <CardHeader className="px-5 pt-5 pb-3">
            <CardTitle className="text-sm font-semibold">Preview</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex items-start gap-3 rounded-xl border border-[#5b4a12] border-l-4 border-l-amber-500 bg-[#26210f] p-3.5">
              <span className="text-xl" aria-hidden="true">📢</span>
              <div className="min-w-0">
                <div className="text-sm font-bold">{title || "Your title"}</div>
                <div className="mt-0.5 break-words text-[12.5px] leading-snug text-[#c4c6cb]">{message || "Your message will appear here."}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
