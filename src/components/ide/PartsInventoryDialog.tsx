import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Plus,
  Search,
  Sparkles,
  Loader2,
  MapPin,
  Tag,
  Info,
  Trash2,
  Edit2,
  Box,
  Cpu,
  Cog,
  Zap,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Part {
  id: string;
  name: string;
  description: string | null;
  category: string;
  quantity: number;
  location: string | null;
  location_detail: string | null;
  part_number: string | null;
  manufacturer: string | null;
  specifications: Record<string, any>;
  tags: string[];
  compatible_with: string[];
  platform: string;
  ai_details: Record<string, any>;
  team_id: string | null;
  user_id: string;
  created_at: string;
}

interface PartsInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTemplate?: string;
  teamId?: string | null;
}

const CATEGORIES = [
  { value: "motor", label: "Motor", icon: Cog },
  { value: "servo", label: "Servo", icon: Cog },
  { value: "sensor", label: "Sensor", icon: Cpu },
  { value: "controller", label: "Controller", icon: Cpu },
  { value: "structural", label: "Structural", icon: Box },
  { value: "electrical", label: "Electrical", icon: Zap },
  { value: "connector", label: "Connector", icon: Zap },
  { value: "wheel", label: "Wheel", icon: Cog },
  { value: "gear", label: "Gear", icon: Cog },
  { value: "bearing", label: "Bearing", icon: Cog },
  { value: "fastener", label: "Fastener", icon: Box },
  { value: "battery", label: "Battery", icon: Zap },
  { value: "cable", label: "Cable", icon: Zap },
  { value: "other", label: "Other", icon: Package },
];

export const PartsInventoryDialog = ({
  open,
  onOpenChange,
  currentTemplate,
  teamId,
}: PartsInventoryDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [tab, setTab] = useState<"inventory" | "add">("inventory");

  // Add part form
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("other");
  const [newQuantity, setNewQuantity] = useState(1);
  const [newLocation, setNewLocation] = useState("");
  const [newLocationDetail, setNewLocationDetail] = useState("");
  const [newPlatform, setNewPlatform] = useState(
    currentTemplate === "ftc" ? "ftc" : currentTemplate === "arduino" ? "arduino" : "general"
  );
  const [newTags, setNewTags] = useState("");
  const [aiIdentifying, setAiIdentifying] = useState(false);
  const [aiDetails, setAiDetails] = useState<Record<string, any> | null>(null);
  const [aiDescription, setAiDescription] = useState("");
  const [aiManufacturer, setAiManufacturer] = useState("");
  const [aiPartNumber, setAiPartNumber] = useState("");
  const [aiSpecs, setAiSpecs] = useState<Record<string, any>>({});
  const [aiCompatible, setAiCompatible] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Detail view
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);

  const fetchParts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from("parts_inventory")
        .select("*")
        .order("created_at", { ascending: false });

      if (teamId) {
        query = query.or(`user_id.eq.${user.id},team_id.eq.${teamId}`);
      } else {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setParts((data as any[]) || []);
    } catch (e: any) {
      toast({ title: "Error loading parts", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, teamId, toast]);

  useEffect(() => {
    if (open && user) fetchParts();
  }, [open, user, fetchParts]);

  // Realtime subscription
  useEffect(() => {
    if (!open || !user) return;
    const channel = supabase
      .channel("parts-inventory")
      .on("postgres_changes", { event: "*", schema: "public", table: "parts_inventory" }, () => {
        fetchParts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [open, user, fetchParts]);

  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.part_number?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === "all" || p.category === filterCategory;
      const matchesPlatform = filterPlatform === "all" || p.platform === filterPlatform;
      return matchesSearch && matchesCategory && matchesPlatform;
    });
  }, [parts, searchQuery, filterCategory, filterPlatform]);

  const identifyWithAI = async () => {
    if (!newName.trim()) return;
    setAiIdentifying(true);
    setAiDetails(null);
    try {
      const { data, error } = await supabase.functions.invoke("identify-part", {
        body: { partName: newName, platform: newPlatform },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setAiDetails(data);
      setAiDescription(data.description || "");
      setAiManufacturer(data.manufacturer || "");
      setAiPartNumber(data.partNumber || "");
      setAiSpecs(data.specifications || {});
      setAiCompatible(data.compatibleWith || []);
      if (data.category) setNewCategory(data.category);
      toast({ title: "Part identified!", description: "AI filled in details for you." });
    } catch (e: any) {
      toast({ title: "AI identification failed", description: e.message, variant: "destructive" });
    } finally {
      setAiIdentifying(false);
    }
  };

  const savePart = async () => {
    if (!user || !newName.trim()) return;
    setSaving(true);
    try {
      const tags = newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const { error } = await supabase.from("parts_inventory").insert({
        user_id: user.id,
        team_id: teamId || null,
        name: newName.trim(),
        description: aiDescription || null,
        category: newCategory,
        quantity: newQuantity,
        location: newLocation || null,
        location_detail: newLocationDetail || null,
        part_number: aiPartNumber || null,
        manufacturer: aiManufacturer || null,
        specifications: aiSpecs,
        tags,
        compatible_with: aiCompatible,
        platform: newPlatform,
        ai_details: aiDetails || {},
      } as any);

      if (error) throw error;
      toast({ title: "Part added!" });
      resetForm();
      setTab("inventory");
      fetchParts();
    } catch (e: any) {
      toast({ title: "Error saving part", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deletePart = async (id: string) => {
    try {
      const { error } = await supabase.from("parts_inventory").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Part deleted" });
      if (selectedPart?.id === id) setSelectedPart(null);
      fetchParts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setNewName("");
    setNewCategory("other");
    setNewQuantity(1);
    setNewLocation("");
    setNewLocationDetail("");
    setNewTags("");
    setAiDetails(null);
    setAiDescription("");
    setAiManufacturer("");
    setAiPartNumber("");
    setAiSpecs({});
    setAiCompatible([]);
  };

  const getCategoryIcon = (cat: string) => {
    const found = CATEGORIES.find((c) => c.value === cat);
    const Icon = found?.icon || Package;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Parts Inventory
          </DialogTitle>
          <DialogDescription>
            Manage your robotics &amp; electronics parts. AI identifies details automatically.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="inventory" className="flex-1">
              <Search className="w-4 h-4 mr-1" /> Inventory ({parts.length})
            </TabsTrigger>
            <TabsTrigger value="add" className="flex-1">
              <Plus className="w-4 h-4 mr-1" /> Add Part
            </TabsTrigger>
          </TabsList>

          {/* ---- INVENTORY TAB ---- */}
          <TabsContent value="inventory" className="flex-1 min-h-0 flex flex-col gap-3 mt-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search parts, locations, tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ftc">FTC</SelectItem>
                  <SelectItem value="arduino">Arduino</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedPart ? (
              <div className="flex-1 min-h-0">
                <Button variant="ghost" size="sm" onClick={() => setSelectedPart(null)} className="mb-2">
                  ← Back to list
                </Button>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4 pr-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          {getCategoryIcon(selectedPart.category)}
                          {selectedPart.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">{selectedPart.description}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deletePart(selectedPart.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-muted-foreground text-xs mb-1">Category</p>
                        <p className="font-medium capitalize">{selectedPart.category}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-muted-foreground text-xs mb-1">Quantity</p>
                        <p className="font-medium">{selectedPart.quantity}</p>
                      </div>
                      {selectedPart.location && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> Location
                          </p>
                          <p className="font-medium">{selectedPart.location}</p>
                          {selectedPart.location_detail && (
                            <p className="text-xs text-muted-foreground">{selectedPart.location_detail}</p>
                          )}
                        </div>
                      )}
                      {selectedPart.manufacturer && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-muted-foreground text-xs mb-1">Manufacturer</p>
                          <p className="font-medium">{selectedPart.manufacturer}</p>
                        </div>
                      )}
                      {selectedPart.part_number && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-muted-foreground text-xs mb-1">Part Number</p>
                          <p className="font-medium">{selectedPart.part_number}</p>
                        </div>
                      )}
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-muted-foreground text-xs mb-1">Platform</p>
                        <p className="font-medium uppercase">{selectedPart.platform}</p>
                      </div>
                    </div>

                    {selectedPart.tags?.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Tag className="w-3 h-3" /> Tags
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {selectedPart.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedPart.compatible_with?.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Compatible With</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedPart.compatible_with.map((c) => (
                            <Badge key={c} variant="outline" className="text-xs uppercase">{c}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {Object.keys(selectedPart.specifications || {}).length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Specifications</p>
                        <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                          {Object.entries(selectedPart.specifications).map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                              <span className="font-medium">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedPart.ai_details?.commonUses && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Common Uses
                        </p>
                        <ul className="text-sm list-disc list-inside space-y-0.5">
                          {(selectedPart.ai_details.commonUses as string[]).map((u, i) => (
                            <li key={i}>{u}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedPart.ai_details?.tips && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                        <p className="text-xs text-primary font-medium mb-1 flex items-center gap-1">
                          <Info className="w-3 h-3" /> Pro Tip
                        </p>
                        {selectedPart.ai_details.tips}
                      </div>
                    )}

                    {selectedPart.ai_details?.alternativeParts?.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Alternatives</p>
                        <div className="flex flex-wrap gap-1">
                          {(selectedPart.ai_details.alternativeParts as string[]).map((a, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <ScrollArea className="flex-1 min-h-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredParts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">No parts found</p>
                    <p className="text-sm">Add your first part to get started</p>
                  </div>
                ) : (
                  <div className="space-y-1 pr-4">
                    {filteredParts.map((part) => (
                      <button
                        key={part.id}
                        className="w-full text-left p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors flex items-center gap-3"
                        onClick={() => setSelectedPart(part)}
                      >
                        <div className="shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                          {getCategoryIcon(part.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{part.name}</span>
                            <Badge variant="outline" className="text-[10px] uppercase shrink-0">{part.platform}</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {part.location && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-3 h-3" /> {part.location}
                              </span>
                            )}
                            <span>×{part.quantity}</span>
                            <span className="capitalize">{part.category}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
          </TabsContent>

          {/* ---- ADD PART TAB ---- */}
          <TabsContent value="add" className="flex-1 min-h-0 mt-3">
            <ScrollArea className="h-[450px]">
              <div className="space-y-4 pr-4">
                {/* Part name + AI identify */}
                <div className="space-y-2">
                  <Label>Part Name *</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. REV HD Hex Motor, Arduino Uno, 220Ω Resistor..."
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={identifyWithAI}
                      disabled={!newName.trim() || aiIdentifying}
                      variant="secondary"
                      className="shrink-0"
                    >
                      {aiIdentifying ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-1" />
                      )}
                      AI Identify
                    </Button>
                  </div>
                </div>

                {aiDetails && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                    <p className="font-medium text-primary flex items-center gap-1 mb-1">
                      <Sparkles className="w-3 h-3" /> AI identified this part
                    </p>
                    <p className="text-muted-foreground">{aiDescription}</p>
                    {aiDetails.tips && (
                      <p className="mt-1 text-xs italic">💡 {aiDetails.tips}</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <Select value={newPlatform} onValueChange={setNewPlatform}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ftc">FTC</SelectItem>
                        <SelectItem value="arduino">Arduino</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Manufacturer</Label>
                    <Input
                      value={aiManufacturer}
                      onChange={(e) => setAiManufacturer(e.target.value)}
                      placeholder="e.g. REV Robotics, Adafruit..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    placeholder="What does this part do?"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Location
                    </Label>
                    <Input
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="e.g. Bin A3, Shelf 2, Toolbox..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location Detail</Label>
                    <Input
                      value={newLocationDetail}
                      onChange={(e) => setNewLocationDetail(e.target.value)}
                      placeholder="e.g. Top drawer, left side..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Tags (comma separated)
                  </Label>
                  <Input
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="e.g. drivetrain, intake, spare..."
                  />
                </div>

                {aiPartNumber && (
                  <div className="space-y-2">
                    <Label>Part Number</Label>
                    <Input
                      value={aiPartNumber}
                      onChange={(e) => setAiPartNumber(e.target.value)}
                    />
                  </div>
                )}

                {Object.keys(aiSpecs).length > 0 && (
                  <div className="space-y-2">
                    <Label>Specifications (from AI)</Label>
                    <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                      {Object.entries(aiSpecs).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                          <span className="font-medium">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button onClick={savePart} disabled={!newName.trim() || saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  Add to Inventory
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
