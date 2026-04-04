import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Camera,
  UploadCloud,
  Link2,
  DatabaseZap,
  ExternalLink,
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

interface VendorCatalogPart {
  id: string;
  name: string;
  vendor: string;
  category: string;
  price: string;
  partNumber: string;
  description: string;
  platform: "ftc" | "general";
  tags: string[];
}

interface PartsInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTemplate?: string;
  teamId?: string | null;
  preferredPlatform?: "ftc" | "arduino" | "general";
  initialTab?: "inventory" | "add" | "catalog";
  identifyWithImage?: boolean;
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

const VENDOR_HOSTS = [
  "www.gobilda.com",
  "www.andymark.com",
  "www.revrobotics.com",
  "www.studica.com",
  "www.vexrobotics.com",
];

const VENDOR_CATALOG_PARTS: VendorCatalogPart[] = [
  {
    id: "rev-control-hub",
    name: "REV Control Hub",
    vendor: "REV Robotics",
    category: "controller",
    price: "$299.99",
    partNumber: "REV-31-1595",
    description: "Android-based robot controller for FTC with integrated Wi-Fi AP.",
    platform: "ftc",
    tags: ["control", "hub", "brain"],
  },
  {
    id: "rev-expansion-hub",
    name: "REV Expansion Hub",
    vendor: "REV Robotics",
    category: "controller",
    price: "$239.00",
    partNumber: "REV-31-1153",
    description: "Additional motor/servo/sensor hub used with legacy FTC architectures.",
    platform: "ftc",
    tags: ["legacy", "expansion"],
  },
  {
    id: "gobilda-5203-435rpm",
    name: "goBILDA 5203 Yellow Jacket Motor (435 RPM)",
    vendor: "goBILDA",
    category: "motor",
    price: "$37.99",
    partNumber: "5203-2402-0019",
    description: "Popular drivetrain/utility gearmotor with encoder and robust gearbox.",
    platform: "ftc",
    tags: ["drivetrain", "yellow jacket", "encoder"],
  },
  {
    id: "gobilda-96mm-wheel",
    name: "goBILDA Mecanum Wheel Set (96mm)",
    vendor: "goBILDA",
    category: "wheel",
    price: "$89.99",
    partNumber: "3613-0001-0096",
    description: "Set of four mecanum wheels for holonomic FTC drivetrains.",
    platform: "ftc",
    tags: ["mecanum", "drive"],
  },
  {
    id: "andymark-neverest-orbital",
    name: "AndyMark NeveRest Orbital 20",
    vendor: "AndyMark",
    category: "motor",
    price: "$43.00",
    partNumber: "am-4198",
    description: "Planetary gearmotor commonly used in older FTC robots.",
    platform: "ftc",
    tags: ["planetary", "legacy"],
  },
  {
    id: "andymark-compliant-wheel",
    name: "AndyMark 3in Compliant Wheel",
    vendor: "AndyMark",
    category: "wheel",
    price: "$9.50",
    partNumber: "am-4970",
    description: "Compliant wheel frequently used for intake systems.",
    platform: "ftc",
    tags: ["intake", "compliant"],
  },
  {
    id: "rev-2m-distance",
    name: "REV 2m Distance Sensor",
    vendor: "REV Robotics",
    category: "sensor",
    price: "$49.00",
    partNumber: "REV-31-1505",
    description: "I2C time-of-flight distance sensor with mm-level output.",
    platform: "ftc",
    tags: ["distance", "tof", "i2c"],
  },
  {
    id: "rev-servo-power-module",
    name: "REV Servo Power Module",
    vendor: "REV Robotics",
    category: "electrical",
    price: "$17.50",
    partNumber: "REV-11-1144",
    description: "Dedicated servo rail power support for high-load mechanisms.",
    platform: "ftc",
    tags: ["servo", "power"],
  },
  {
    id: "studica-navx2",
    name: "Studica navX2-Micro",
    vendor: "Studica",
    category: "sensor",
    price: "$99.00",
    partNumber: "NAVX2-MXP",
    description: "Inertial/nav sensor used for heading and motion feedback.",
    platform: "general",
    tags: ["imu", "heading"],
  },
  {
    id: "vex-versa-planetary",
    name: "VEX VersaPlanetary Gearbox",
    vendor: "VEX",
    category: "gear",
    price: "$54.99",
    partNumber: "217-3720",
    description: "Configurable gearbox for mechanism power transmission.",
    platform: "general",
    tags: ["gearbox", "mechanism"],
  },
];

const FRA_FIMS_SUPABASE_URL = "https://jqvsscyydmclxafjznhn.supabase.co";
const FRA_FIMS_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxdnNzY3l5ZG1jbHhhZmp6bmhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMTM2NTgsImV4cCI6MjA4NDg4OTY1OH0.n57L79kwj3iW2-rGW19p1WD5WblHNSkxuD5zDR6Z00k";

const parseCsvRows = (csvText: string) => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] || "";
    });
    return row;
  });
};

export const PartsInventoryDialog = ({
  open,
  onOpenChange,
  currentTemplate,
  teamId,
  preferredPlatform,
  initialTab = "inventory",
  identifyWithImage = false,
}: PartsInventoryDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const derivedPlatform =
    preferredPlatform ||
    (currentTemplate === "ftc" ? "ftc" : currentTemplate === "arduino" ? "arduino" : "general");
  const [activePlatform, setActivePlatform] = useState<"ftc" | "arduino" | "general">(derivedPlatform);
  const [tab, setTab] = useState<"inventory" | "add" | "catalog">("inventory");

  // Add part form
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("other");
  const [newQuantity, setNewQuantity] = useState(1);
  const [newLocation, setNewLocation] = useState("");
  const [newLocationDetail, setNewLocationDetail] = useState("");
  const [newPlatform, setNewPlatform] = useState<"ftc" | "arduino" | "general">(derivedPlatform);
  const [newTags, setNewTags] = useState("");
  const [aiIdentifying, setAiIdentifying] = useState(false);
  const [aiDetails, setAiDetails] = useState<Record<string, any> | null>(null);
  const [aiDescription, setAiDescription] = useState("");
  const [aiManufacturer, setAiManufacturer] = useState("");
  const [aiPartNumber, setAiPartNumber] = useState("");
  const [aiSpecs, setAiSpecs] = useState<Record<string, any>>({});
  const [aiCompatible, setAiCompatible] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [vendorUrl, setVendorUrl] = useState("");
  const [partImageBase64, setPartImageBase64] = useState<string | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkCsvSummary, setBulkCsvSummary] = useState<string>("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogVendor, setCatalogVendor] = useState<string>("all");
  const [catalogCategory, setCatalogCategory] = useState<string>("all");
  const csvFileRef = useRef<HTMLInputElement | null>(null);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const [fraSyncing, setFraSyncing] = useState(false);
  const [fraCatalogParts, setFraCatalogParts] = useState<VendorCatalogPart[]>([]);

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

  useEffect(() => {
    setActivePlatform(derivedPlatform);
    setNewPlatform(derivedPlatform);
  }, [derivedPlatform, open]);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

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
      const matchesPlatform =
        p.platform === activePlatform || (activePlatform !== "general" && p.platform === "general");
      return matchesSearch && matchesCategory && matchesPlatform;
    });
  }, [parts, searchQuery, filterCategory, activePlatform]);

  const identifyWithAI = async () => {
    if (!newName.trim()) return;
    setAiIdentifying(true);
    setAiDetails(null);
    try {
      const existing = parts.find(
        (p) =>
          p.name.trim().toLowerCase() === newName.trim().toLowerCase() &&
          (p.platform === newPlatform || p.platform === "general"),
      );

      if (existing) {
        setAiDetails(existing.ai_details || {});
        setAiDescription(existing.description || "");
        setAiManufacturer(existing.manufacturer || "");
        setAiPartNumber(existing.part_number || "");
        setAiSpecs(existing.specifications || {});
        setAiCompatible(existing.compatible_with || []);
        setNewCategory(existing.category || "other");
        toast({
          title: "Loaded from parts library",
          description: "This part already exists, so AI did not regenerate it.",
        });
        return;
      }

      const aiCacheKey = `parts-ai-library-${newPlatform}`;
      const cached = localStorage.getItem(aiCacheKey);
      if (cached) {
        const cachedParts: Record<string, any> = JSON.parse(cached);
        const cachedPart = cachedParts[newName.trim().toLowerCase()];
        if (cachedPart) {
          setAiDetails(cachedPart);
          setAiDescription(cachedPart.description || "");
          setAiManufacturer(cachedPart.manufacturer || "");
          setAiPartNumber(cachedPart.partNumber || "");
          setAiSpecs(cachedPart.specifications || {});
          setAiCompatible(cachedPart.compatibleWith || []);
          if (cachedPart.category) setNewCategory(cachedPart.category);
          toast({ title: "Loaded from AI library cache", description: "Reused previous AI identification." });
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke("identify-part", {
        body: { partName: newName, platform: newPlatform, vendorUrl, imageBase64: partImageBase64 },
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
      const cachedAfter = localStorage.getItem(aiCacheKey);
      const cacheData = cachedAfter ? JSON.parse(cachedAfter) : {};
      cacheData[newName.trim().toLowerCase()] = data;
      localStorage.setItem(aiCacheKey, JSON.stringify(cacheData));
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

  const handleImageUpload = async (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      setPartImageBase64(value);
    };
    reader.readAsDataURL(file);
  };

  const handleBulkImportCsv = async (csvText: string) => {
    if (!user) return;
    const rows = parseCsvRows(csvText);
    if (!rows.length) {
      toast({ title: "No rows found", description: "CSV needs a header and at least one row." });
      return;
    }

    setBulkImporting(true);
    let imported = 0;
    let aiEnhanced = 0;
    try {
      for (const row of rows) {
        const name = row.name || row.part_name || row.item || "";
        if (!name) continue;
        let description = row.description || null;
        let category = row.category || "other";
        let manufacturer = row.manufacturer || null;
        let partNumber = row.part_number || row.partnumber || null;
        const quantity = Number(row.quantity || "1") || 1;
        let specifications: Record<string, any> = {};

        if (!description || !manufacturer || category === "other") {
          const ai = await supabase.functions.invoke("identify-part", {
            body: { partName: name, platform: activePlatform },
          });
          if (!ai.error && ai.data && !ai.data.error) {
            description = description || ai.data.description || null;
            category = category === "other" ? ai.data.category || "other" : category;
            manufacturer = manufacturer || ai.data.manufacturer || null;
            partNumber = partNumber || ai.data.partNumber || null;
            specifications = ai.data.specifications || {};
            aiEnhanced += 1;
          }
        }

        const { error } = await supabase.from("parts_inventory").insert({
          user_id: user.id,
          team_id: teamId || null,
          name,
          description,
          category,
          quantity,
          location: row.location || null,
          location_detail: row.location_detail || null,
          part_number: partNumber,
          manufacturer,
          specifications,
          tags: (row.tags || "")
            .split("|")
            .map((t) => t.trim())
            .filter(Boolean),
          compatible_with: [activePlatform, "general"],
          platform: activePlatform,
          ai_details: {},
        } as any);
        if (!error) imported += 1;
      }
      setBulkCsvSummary(`Imported ${imported} parts (${aiEnhanced} enhanced with AI).`);
      toast({ title: "Bulk import complete", description: `Imported ${imported} part(s).` });
      fetchParts();
    } finally {
      setBulkImporting(false);
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
    setVendorUrl("");
    setPartImageBase64(null);
  };

  const getCategoryIcon = (cat: string) => {
    const found = CATEGORIES.find((c) => c.value === cat);
    const Icon = found?.icon || Package;
    return <Icon className="w-4 h-4" />;
  };

  const catalogParts = useMemo(() => {
    const mergedCatalog = [...VENDOR_CATALOG_PARTS, ...fraCatalogParts];
    return mergedCatalog.filter((part) => {
      const matchesVendor = catalogVendor === "all" || part.vendor === catalogVendor;
      const matchesCategory = catalogCategory === "all" || part.category === catalogCategory;
      const matchesPlatform = activePlatform === "general" ? true : (part.platform === activePlatform || part.platform === "general");
      const search = catalogSearch.trim().toLowerCase();
      const matchesSearch =
        !search ||
        part.name.toLowerCase().includes(search) ||
        part.partNumber.toLowerCase().includes(search) ||
        part.description.toLowerCase().includes(search) ||
        part.tags.some((tag) => tag.toLowerCase().includes(search));
      return matchesVendor && matchesCategory && matchesPlatform && matchesSearch;
    });
  }, [catalogSearch, catalogVendor, catalogCategory, activePlatform, fraCatalogParts]);

  const applyCatalogPartToForm = (part: VendorCatalogPart) => {
    setNewName(part.name);
    setAiDescription(part.description);
    setAiManufacturer(part.vendor);
    setAiPartNumber(part.partNumber);
    setNewCategory(part.category);
    setNewPlatform(activePlatform === "general" ? part.platform : activePlatform);
    setAiDetails({
      source: "vendor-catalog",
      vendor: part.vendor,
      price: part.price,
      tags: part.tags,
    });
    setTab("add");
    toast({ title: "Catalog part loaded", description: "Review fields and click Add Part to save." });
  };

  const syncFraFimsCatalog = async () => {
    setFraSyncing(true);
    try {
      const response = await fetch(
        `${FRA_FIMS_SUPABASE_URL}/rest/v1/Products?select=vendor,name,sku,category,price,product_url,tags&order=name.asc&limit=1000`,
        {
          headers: {
            apikey: FRA_FIMS_ANON_KEY,
            Authorization: `Bearer ${FRA_FIMS_ANON_KEY}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error(`FRA FIMS catalog request failed (${response.status})`);
      }

      const rows = await response.json();
      const mapped: VendorCatalogPart[] = (rows || []).map((row: any) => ({
        id: `fra-${row.sku || row.name}`,
        name: row.name || "Unnamed part",
        vendor: row.vendor || "FRA FIMS",
        category: (row.category || "other").toLowerCase(),
        price: typeof row.price === "number" ? `$${row.price.toFixed(2)}` : "$0.00",
        partNumber: row.sku || "N/A",
        description: row.product_url || "Synced from FRA FIMS catalog.",
        platform: "ftc",
        tags: String(row.tags || "")
          .split("|")
          .map((tag) => tag.trim())
          .filter(Boolean),
      }));
      setFraCatalogParts(mapped);
      toast({ title: "FRA FIMS synced", description: `Loaded ${mapped.length} catalog parts.` });
    } catch (e: any) {
      toast({ title: "FRA FIMS sync failed", description: e.message, variant: "destructive" });
    } finally {
      setFraSyncing(false);
    }
  };

  useEffect(() => {
    if (!open || activePlatform !== "ftc") return;
    syncFraFimsCatalog();
    // intentionally run when dialog opens or platform switches
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activePlatform]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {activePlatform.toUpperCase()} Parts Library
          </DialogTitle>
          <DialogDescription>
            Dedicated {activePlatform.toUpperCase()} inventory with AI-assisted detection, material hints, and vendor lookups.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {(["ftc", "arduino", "general"] as const).map((platform) => (
            <Button
              key={platform}
              type="button"
              size="sm"
              variant={activePlatform === platform ? "default" : "outline"}
              onClick={() => {
                setActivePlatform(platform);
                setNewPlatform(platform);
              }}
            >
              {platform.toUpperCase()}
            </Button>
          ))}
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "inventory" | "add" | "catalog")} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="w-full">
            <TabsTrigger value="inventory" className="flex-1">
              <Search className="w-4 h-4 mr-1" /> Inventory ({parts.length})
            </TabsTrigger>
            <TabsTrigger value="catalog" className="flex-1">
              <DatabaseZap className="w-4 h-4 mr-1" /> Vendor Catalog
            </TabsTrigger>
            <TabsTrigger value="add" className="flex-1">
              <Plus className="w-4 h-4 mr-1" /> Add Part
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="flex-1 min-h-0 flex flex-col gap-3 mt-3">
            {activePlatform === "ftc" && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex flex-col md:flex-row gap-2">
                  <Button type="button" variant="outline" onClick={() => window.open("https://fra-fims.vercel.app/", "_blank", "noopener,noreferrer")}>
                    <ExternalLink className="w-4 h-4 mr-1" /> Open FRA FIMS
                  </Button>
                  <Button type="button" variant="secondary" onClick={syncFraFimsCatalog} disabled={fraSyncing || bulkImporting}>
                    {fraSyncing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <DatabaseZap className="w-4 h-4 mr-1" />}
                    Refresh FRA FIMS Catalog
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Live catalog data is pulled from FRA FIMS product inventory.
                </p>
              </div>
            )}
            <div className="flex flex-col md:flex-row gap-2">
              <Input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Search vendor parts by name, part number, or tag..."
              />
              <Select value={catalogVendor} onValueChange={setCatalogVendor}>
                <SelectTrigger className="md:w-[180px]">
                  <SelectValue placeholder="Vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {["REV Robotics", "goBILDA", "AndyMark", "Studica", "VEX"].map((vendor) => (
                    <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={catalogCategory} onValueChange={setCatalogCategory}>
                <SelectTrigger className="md:w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              {catalogParts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <DatabaseZap className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="font-medium">No catalog matches</p>
                  <p className="text-sm">Try another vendor or search term.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-4">
                  {catalogParts.map((part) => (
                    <div key={part.id} className="rounded-lg border border-border p-3 bg-card space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{part.name}</p>
                          <p className="text-xs text-muted-foreground">{part.vendor} • {part.partNumber}</p>
                        </div>
                        <Badge variant="outline">{part.price}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{part.description}</p>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="capitalize">{part.category}</Badge>
                        {part.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                        ))}
                      </div>
                      <Button type="button" size="sm" className="w-full" onClick={() => applyCatalogPartToForm(part)}>
                        <Plus className="w-3 h-3 mr-1" /> Use in Add Form
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

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
                  {identifyWithImage && (
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-medium text-primary">
                        <Camera className="w-3 h-3" /> Image identification mode
                      </span>
                      <p className="mt-1">Upload a part photo below, then click <strong>AI Identify</strong>.</p>
                    </div>
                  )}
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
                    <Label>Library</Label>
                    <div className="h-10 px-3 rounded-md border border-input flex items-center">
                      <Badge variant="secondary" className="uppercase">{newPlatform}</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> Vendor product URL
                  </Label>
                  <Input
                    value={vendorUrl}
                    onChange={(e) => setVendorUrl(e.target.value)}
                    placeholder={`https://${VENDOR_HOSTS[0]}/...`}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Supports goBILDA, AndyMark, REV, Studica, VEX, and similar vendor product pages.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Camera className="w-3 h-3" /> Material / part image
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => cameraCaptureInputRef.current?.click()}>
                      <Camera className="w-4 h-4 mr-1" /> Open Camera
                    </Button>
                    <Button type="button" variant="outline" onClick={() => imageUploadInputRef.current?.click()}>
                      <UploadCloud className="w-4 h-4 mr-1" /> Upload Image
                    </Button>
                    <Button type="button" variant="outline" onClick={() => csvFileRef.current?.click()}>
                      <UploadCloud className="w-4 h-4 mr-1" /> Upload CSV
                    </Button>
                  </div>
                  <Input
                    ref={imageUploadInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files?.[0])}
                  />
                  <Input
                    ref={cameraCaptureInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files?.[0])}
                  />
                  <Input
                    ref={csvFileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const text = await file.text();
                      await handleBulkImportCsv(text);
                    }}
                  />
                  {partImageBase64 && (
                    <img src={partImageBase64} alt="Part preview" className="h-24 w-24 object-cover rounded-md border border-border" />
                  )}
                  {bulkCsvSummary && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <DatabaseZap className="w-3 h-3" /> {bulkCsvSummary}
                    </p>
                  )}
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
