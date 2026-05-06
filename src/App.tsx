import React, { useState, useRef, useEffect, useMemo, useCallback, Component, ReactNode } from 'react';
import { 
  Plus, 
  Download, 
  Trash2, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Settings,
  Settings2,
  LayoutGrid,
  Type,
  Users,
  Layers,
  MoreVertical,
  X,
  Edit2,
  Flag,
  Check,
  LogIn,
  LogOut,
  Info,
  Copy
} from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachMonthOfInterval, 
  differenceInCalendarDays,
  differenceInDays, 
  startOfDay, 
  isWithinInterval,
  addDays,
  subDays,
  isSameMonth,
  isSameDay,
  parseISO,
  fromUnixTime
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Toaster, toast } from 'sonner';
import { toPng } from 'html-to-image';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { cn } from './lib/utils';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import * as Popover from '@radix-ui/react-popover';
import * as Switch from '@radix-ui/react-switch';
import * as Label from '@radix-ui/react-label';
import * as Tooltip from '@radix-ui/react-tooltip';
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  deleteField,
  Timestamp,
  writeBatch
} from 'firebase/firestore';

interface Feature {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  color: string;
  order: number;
  startSprint?: number;
  endSprint?: number;
  isNew?: boolean;
  priority?: number;
}

interface TeamMember {
  id: string;
  name: string;
  color: string;
}

interface Leave {
  id: string;
  memberId: string;
  startDate: Date;
  endDate: Date;
  label: string;
}

interface Milestone {
  id: string;
  name: string;
  description?: string;
  date: Date;
  color: string;
}

const FRENCH_SCHOOL_HOLIDAYS = [
  // 2025
  { zone: 'A', start: new Date(2025, 1, 22), end: new Date(2025, 2, 10) },
  { zone: 'B', start: new Date(2025, 1, 8), end: new Date(2025, 1, 24) },
  { zone: 'C', start: new Date(2025, 1, 15), end: new Date(2025, 2, 3) },
  { zone: 'A', start: new Date(2025, 3, 19), end: new Date(2025, 4, 5) },
  { zone: 'B', start: new Date(2025, 3, 5), end: new Date(2025, 3, 21) },
  { zone: 'C', start: new Date(2025, 3, 12), end: new Date(2025, 3, 28) },
  { zone: 'All', start: new Date(2025, 4, 28), end: new Date(2025, 5, 2) },
  { zone: 'All', start: new Date(2025, 6, 5), end: new Date(2025, 8, 1) },
  { zone: 'All', start: new Date(2025, 9, 18), end: new Date(2025, 10, 3) },
  { zone: 'All', start: new Date(2025, 11, 20), end: new Date(2026, 0, 5) },
  // 2026
  { zone: 'A', start: new Date(2026, 1, 7), end: new Date(2026, 1, 23) },
  { zone: 'B', start: new Date(2026, 1, 14), end: new Date(2026, 2, 2) },
  { zone: 'C', start: new Date(2026, 1, 21), end: new Date(2026, 2, 9) },
  { zone: 'A', start: new Date(2026, 3, 4), end: new Date(2026, 3, 20) },
  { zone: 'B', start: new Date(2026, 3, 11), end: new Date(2026, 3, 27) },
  { zone: 'C', start: new Date(2026, 3, 18), end: new Date(2026, 4, 4) },
  // Ascension Bridge 2026
  { zone: 'All', start: new Date(2026, 4, 13), end: new Date(2026, 4, 18) },
  // Summer 2026
  { zone: 'All', start: new Date(2026, 6, 4), end: new Date(2026, 8, 1) },
  // Toussaint 2026
  { zone: 'All', start: new Date(2026, 9, 17), end: new Date(2026, 10, 2) },
  // Christmas 2026
  { zone: 'All', start: new Date(2026, 11, 19), end: new Date(2027, 0, 4) },
  // 2027
  { zone: 'A', start: new Date(2027, 1, 6), end: new Date(2027, 1, 22) },
  { zone: 'B', start: new Date(2027, 1, 13), end: new Date(2027, 2, 1) },
  { zone: 'C', start: new Date(2027, 1, 20), end: new Date(2027, 2, 8) },
  { zone: 'A', start: new Date(2027, 3, 10), end: new Date(2027, 3, 26) },
  { zone: 'B', start: new Date(2027, 3, 17), end: new Date(2027, 4, 3) },
  { zone: 'C', start: new Date(2027, 3, 3), end: new Date(2027, 3, 19) },
  { zone: 'All', start: new Date(2027, 4, 5), end: new Date(2027, 4, 10) },
  { zone: 'All', start: new Date(2027, 6, 3), end: new Date(2027, 8, 1) },
];

const getFrenchPublicHolidays = (year: number) => {
  const holidays: { date: Date; name: string }[] = [
    { date: new Date(year, 0, 1), name: "Jour de l'an" },
    { date: new Date(year, 4, 1), name: "Fête du travail" },
    { date: new Date(year, 4, 8), name: "Victoire 1945" },
    { date: new Date(year, 6, 14), name: "Fête nationale" },
    { date: new Date(year, 7, 15), name: "Assomption" },
    { date: new Date(year, 10, 1), name: "Toussaint" },
    { date: new Date(year, 10, 11), name: "Armistice 1918" },
    { date: new Date(year, 11, 25), name: "Noël" },
  ];

  // Easter calculation (Meeus/Jones/Butcher algorithm)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easterDate = new Date(year, month - 1, day);
  
  holidays.push({ date: addDays(easterDate, 1), name: "Lundi de Pâques" });
  holidays.push({ date: addDays(easterDate, 39), name: "Ascension" });
  holidays.push({ date: addDays(easterDate, 50), name: "Lundi de Pentecôte" });

  return holidays;
};

const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const isHoliday = (date: Date) => {
  const holidays = getFrenchPublicHolidays(date.getFullYear());
  return holidays.some(h => isSameDay(h.date, date));
};

interface GanttSettings {
  title: string;
  subtitle: string;
  sprintStartDate: Date;
}

interface Roadmap {
  id: string;
  name: string;
  description?: string;
  sprintStartDate: Date;
  ownerId: string;
  createdAt: Date;
  viewStartDate?: Date;
  viewEndDate?: Date;
  showSprints?: boolean;
  showMilestoneNames?: boolean;
  order?: number;
  isVisibleToAll?: boolean;
}

interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'viewer';
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

const ReorderItemWithHandle = ({ feature, isActive, onClick }: { feature: Feature, isActive: boolean, onClick: () => void, key?: any }) => {
  const controls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);

  return (
    <Reorder.Item 
      value={feature} 
      dragListener={false} 
      dragControls={controls}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => {
        // Use a slightly longer timeout to ensure click event is blocked
        setTimeout(() => setIsDragging(false), 200);
      }}
      className="flex items-center gap-2 group"
    >
      <div 
        onPointerDown={(e) => {
          e.stopPropagation();
          controls.start(e);
        }}
        className="cursor-grab active:cursor-grabbing p-1 opacity-40 group-hover:opacity-100 transition-opacity"
      >
        <MoreVertical className="w-3 h-3 text-slate-400" />
      </div>
      <button 
        onClick={() => {
          if (!isDragging) onClick();
        }}
        className={cn(
          "flex-1 text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-3",
          isActive ? "bg-indigo-50 text-indigo-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"
        )}
      >
        <div 
          className={cn("w-2 h-2 rounded-full shrink-0", feature.color.startsWith('bg-') ? feature.color : "")} 
          style={!feature.color.startsWith('bg-') ? { backgroundColor: feature.color } : {}}
        />
        {feature.priority && (
          <div className={cn("w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-sm", PRIORITY_COLORS[feature.priority])}>
            {feature.priority}
          </div>
        )}
        <span className="truncate">{feature.name}</span>
      </button>
    </Reorder.Item>
  );
};

interface FeatureRowProps {
  feature: Feature;
  startPos: number;
  width: number;
  isAdmin: boolean;
  resizingFeature: Feature | null;
  resizeHandle: 'start' | 'end' | null;
  setEditingFeature: (f: Feature) => void;
  setIsFeatureModalOpen: (open: boolean) => void;
  handleResizeStart: (e: React.MouseEvent, feature: Feature, handle: 'start' | 'end') => void;
  handleMoveStart: (e: React.MouseEvent, feature: Feature) => void;
  setHoverType: (type: 'feature' | 'leave' | 'milestone' | null) => void;
  setHoveredFeature: (f: Feature | null) => void;
  showSprints: boolean;
  getSprintForDate: (date: Date) => number;
  isSprintView: boolean;
  key?: any;
}

const FeatureRow = ({ 
  feature, 
  startPos, 
  width, 
  isAdmin, 
  resizingFeature, 
  resizeHandle,
  setEditingFeature,
  setIsFeatureModalOpen,
  handleResizeStart,
  handleMoveStart,
  setHoverType,
  setHoveredFeature,
  showSprints,
  getSprintForDate,
  isSprintView
}: FeatureRowProps) => {
  const controls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);

  const days = useMemo(() => {
    if (!isSprintView) return [];
    const d = [];
    let current = startOfDay(feature.startDate);
    const end = startOfDay(feature.endDate);
    while (current <= end) {
      d.push(new Date(current));
      current = addDays(current, 1);
    }
    return d;
  }, [feature.startDate, feature.endDate, isSprintView]);

  return (
    <Reorder.Item 
      value={feature}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => {
        setTimeout(() => setIsDragging(false), 200);
      }}
      className="group relative h-7 flex items-center"
    >
      {/* Drag Handle (Visible for Admin) */}
      {isAdmin && (
        <div 
          onMouseDown={(e) => {
            // Stop propagation to prevent timeline selection from starting
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            controls.start(e);
          }}
          onMouseEnter={(e) => {
            e.stopPropagation();
            setHoverType(null);
          }}
          className="absolute left-2 opacity-40 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 z-20"
        >
          <MoreVertical className="w-3 h-3 text-slate-400" />
        </div>
      )}

      {/* The Bar */}
      <motion.div 
        layoutId={feature.id}
        onMouseDown={(e) => {
          // Stop propagation to prevent timeline selection from starting
          e.stopPropagation();
          if (isAdmin) {
            handleMoveStart(e, feature);
          }
        }}
        onPointerDown={(e) => {
          if (!isAdmin) return;
          // Don't start drag if clicking resize handles
          const target = e.target as HTMLElement;
          if (target.closest('.resize-handle')) return;
          
          e.stopPropagation();
          controls.start(e);
        }}
        onMouseEnter={() => {
          setHoverType('feature');
          setHoveredFeature(feature);
        }}
        onMouseLeave={() => {
          setHoverType(null);
          setHoveredFeature(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!isAdmin) return;
          if (resizingFeature) return;
          if (isDragging) return;
          setEditingFeature(feature);
          setIsFeatureModalOpen(true);
        }}
        className={cn(
          "absolute h-5 rounded-lg shadow-md group/bar transition-transform overflow-hidden",
          isAdmin ? (resizingFeature ? "cursor-ew-resize" : "cursor-pointer hover:scale-[1.02] active:scale-95") : "cursor-default",
          feature.color.startsWith('bg-') ? feature.color : ""
        )}
        style={{ 
          left: `${startPos}%`, 
          width: `${width}%`,
          backgroundColor: feature.color.startsWith('bg-') ? undefined : feature.color
        }}
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={resizingFeature?.id === feature.id ? { duration: 0 } : { duration: 0.4, ease: "circOut" }}
      >
        {/* Weekend and Holiday Overlays */}
        {isSprintView && (
          <div className="absolute inset-0 flex pointer-events-none">
            {days.map((day, i) => {
              const weekend = isWeekend(day);
              const holiday = isHoliday(day);
              return (
                <div 
                  key={i} 
                  className={cn(
                    "h-full flex-1",
                    weekend ? "bg-white/30" : holiday ? "bg-amber-200/40" : ""
                  )} 
                />
              );
            })}
          </div>
        )}

        {/* Sticky-like Label Container */}
        <div 
          className="absolute inset-y-0 flex items-center px-2 min-w-0 gap-2"
          style={{
            left: startPos < 0 ? `${(Math.abs(startPos) / width) * 100}%` : '0',
            width: startPos < 0 ? `${Math.max(0, (1 - Math.abs(startPos) / width) * 100)}%` : '100%'
          }}
        >
          {feature.priority && (
            <div className={cn("w-4 h-4 rounded flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-sm border border-white/20", PRIORITY_COLORS[feature.priority])}>
              {feature.priority}
            </div>
          )}
          <span className="text-white text-[10px] font-bold truncate whitespace-nowrap drop-shadow-sm pointer-events-none">
            {feature.name}
          </span>
        </div>

        {/* Resize Handles */}
        {isAdmin && (
          <>
            <div 
              className={cn(
                "resize-handle absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 z-20 flex items-center justify-center group/handle-l transition-colors",
                resizingFeature?.id === feature.id && resizeHandle === 'start' ? "bg-white/40" : ""
              )}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleResizeStart(e, feature, 'start');
              }}
            >
              <div className="w-0.5 h-3 bg-white/40 rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity" />
            </div>
            <div 
              className={cn(
                "resize-handle absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 z-20 flex items-center justify-center group/handle-r transition-colors",
                resizingFeature?.id === feature.id && resizeHandle === 'end' ? "bg-white/40" : ""
              )}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleResizeStart(e, feature, 'end');
              }}
            >
              <div className="w-0.5 h-3 bg-white/40 rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity" />
            </div>
          </>
        )}

        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none" />
      </motion.div>
    </Reorder.Item>
  );
};

// Error Boundary Component
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    const self = this as any;
    if (self.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
            <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center mb-6">
              <X className="text-rose-600 w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Une erreur est survenue</h2>
            <p className="text-slate-600 mb-6 text-sm">
              L'application a rencontré un problème inattendu. Veuillez rafraîchir la page ou contacter l'administrateur.
            </p>
            <div className="bg-slate-50 rounded-lg p-4 mb-6 overflow-auto max-h-40">
              <code className="text-[10px] text-slate-500 break-all">
                {self.state.error?.message || String(self.state.error)}
              </code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
            >
              Recharger l'application
            </button>
          </div>
        </div>
      );
    }
    return self.props.children;
  }
}

const COLORS = [
  { name: 'Slate', bg: 'bg-slate-500', hex: '#64748b' },
  { name: 'Indigo', bg: 'bg-indigo-500', hex: '#6366f1' },
  { name: 'Emerald', bg: 'bg-emerald-500', hex: '#10b981' },
  { name: 'Amber', bg: 'bg-amber-500', hex: '#f59e0b' },
  { name: 'Rose', bg: 'bg-rose-500', hex: '#f43f5e' },
  { name: 'Sky', bg: 'bg-sky-500', hex: '#0ea5e9' },
  { name: 'Violet', bg: 'bg-violet-500', hex: '#8b5cf6' },
];

const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-rose-600',    // Rouge (Critique)
  2: 'bg-orange-500',  // Orange (Haute)
  3: 'bg-indigo-500',  // Indigo (Moyenne)
  4: 'bg-emerald-500', // Vert (Basse)
  5: 'bg-slate-400',   // Gris (Très basse)
};

export default function App() {
  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors />
      <GanttApp />
    </ErrorBoundary>
  );
}

function GanttApp() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [currentRoadmapId, setCurrentRoadmapId] = useState<string | null>(null);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [activeTab, setActiveTab] = useState<'features' | 'team'>('features');
  const [focusedSprint, setFocusedSprint] = useState<{ start: Date, end: Date, number: number } | null>(null);
  const [isAddingMemberInLeaveModal, setIsAddingMemberInLeaveModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');

  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isRoadmapModalOpen, setIsRoadmapModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editingLeave, setEditingLeave] = useState<Leave | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [editingRoadmap, setEditingRoadmap] = useState<Roadmap | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: Date, end: Date } | null>(null);
  const [selectionType, setSelectionType] = useState<'feature' | 'leave' | 'milestone' | null>(null);
  const [selectionMemberId, setSelectionMemberId] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [hoverType, setHoverType] = useState<'feature' | 'leave' | 'milestone' | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<Feature | null>(null);
  const [hoveredLeave, setHoveredLeave] = useState<Leave | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isSelecting, setIsSelecting] = useState(false);
  const [isSelectingView, setIsSelectingView] = useState(false);
  const [dragOccurred, setDragOccurred] = useState(false);
  const [viewSelectionRange, setViewSelectionRange] = useState<{ start: Date, end: Date } | null>(null);
  const [resizingFeature, setResizingFeature] = useState<Feature | null>(null);
  const [resizeHandle, setResizeHandle] = useState<'start' | 'end' | null>(null);
  const [movingFeature, setMovingFeature] = useState<Feature | null>(null);
  const [moveStartOffset, setMoveStartOffset] = useState<number>(0);

  const [viewStartDate, setViewStartDate] = useState(() => {
    const saved = localStorage.getItem('gantt_viewStartDate');
    if (saved) return new Date(saved);
    const oldViewDate = localStorage.getItem('gantt_viewDate');
    return oldViewDate ? new Date(oldViewDate) : new Date(2026, 2, 1);
  });

  const [viewEndDate, setViewEndDate] = useState(() => {
    const saved = localStorage.getItem('gantt_viewEndDate');
    if (saved) return new Date(saved);
    const months = parseInt(localStorage.getItem('gantt_monthsToShow') || '6', 10);
    const start = localStorage.getItem('gantt_viewStartDate') || localStorage.getItem('gantt_viewDate');
    const startDate = start ? new Date(start) : new Date(2026, 2, 1);
    return endOfMonth(addMonths(startDate, months - 1));
  });

  const [title, setTitle] = useState('Feuille de Route');
  const [subtitle, setSubtitle] = useState('Vision macroscopique des fonctionnalités clés');
  const [showSprints, setShowSprints] = useState(() => {
    const saved = localStorage.getItem('gantt_showSprints');
    return saved !== null ? saved === 'true' : true;
  });
  const [showMilestoneNames, setShowMilestoneNames] = useState(() => {
    const saved = localStorage.getItem('gantt_showMilestoneNames');
    return saved !== null ? saved === 'true' : true;
  });
  const [sprintStartDate, setSprintStartDate] = useState(new Date(2026, 2, 2)); // Default to a Monday

  // Persist local settings
  useEffect(() => {
    localStorage.setItem('gantt_viewStartDate', viewStartDate.toISOString());
  }, [viewStartDate]);

  useEffect(() => {
    localStorage.setItem('gantt_viewEndDate', viewEndDate.toISOString());
  }, [viewEndDate]);

  useEffect(() => {
    localStorage.setItem('gantt_showSprints', showSprints.toString());
  }, [showSprints]);

  useEffect(() => {
    localStorage.setItem('gantt_showMilestoneNames', showMilestoneNames.toString());
  }, [showMilestoneNames]);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const ganttRef = useRef<HTMLDivElement>(null);
  const lastReorderTimeRef = useRef(0);

  const currentRoadmap = useMemo(() => {
    return roadmaps.find(r => r.id === currentRoadmapId) || null;
  }, [roadmaps, currentRoadmapId]);

  const usedColors = useMemo(() => {
    const colors = new Set<string>();
    features.forEach(f => colors.add(f.color));
    milestones.forEach(m => colors.add(m.color));
    teamMembers.forEach(tm => colors.add(tm.color));
    return Array.from(colors);
  }, [features, milestones, teamMembers]);

  // Update local settings when current roadmap changes
  useEffect(() => {
    if (currentRoadmap) {
      if (currentRoadmap.viewStartDate) setViewStartDate(currentRoadmap.viewStartDate);
      if (currentRoadmap.viewEndDate) setViewEndDate(currentRoadmap.viewEndDate);
      if (currentRoadmap.showSprints !== undefined) setShowSprints(currentRoadmap.showSprints);
      if (currentRoadmap.showMilestoneNames !== undefined) setShowMilestoneNames(currentRoadmap.showMilestoneNames);
      setTitle(currentRoadmap.name);
      setSubtitle(currentRoadmap.description || '');
      setSprintStartDate(currentRoadmap.sprintStartDate || new Date(2026, 2, 2));
    }
  }, [currentRoadmap]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Check if user is admin
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setIsAdmin(userDoc.data().role === 'admin');
          } else {
            // Default admin check for richard.gaudin@gmail.com
            if (firebaseUser.email === "richard.gaudin@gmail.com") {
              setIsAdmin(true);
              // Initialize user doc if it doesn't exist
              await setDoc(doc(db, 'users', firebaseUser.uid), {
                email: firebaseUser.email,
                role: 'admin'
              });
            } else {
              setIsAdmin(false);
            }
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!isAuthReady) return;

    // Sync Roadmaps
    const unsubRoadmaps = onSnapshot(collection(db, 'roadmaps'), (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const docData = doc.data();
        return {
          ...docData,
          id: doc.id,
          sprintStartDate: docData.sprintStartDate ? (docData.sprintStartDate as Timestamp).toDate() : new Date(2026, 2, 2),
          viewStartDate: docData.viewStartDate ? (docData.viewStartDate as Timestamp).toDate() : undefined,
          viewEndDate: docData.viewEndDate ? (docData.viewEndDate as Timestamp).toDate() : undefined,
          createdAt: docData.createdAt ? (docData.createdAt as Timestamp).toDate() : new Date(),
          order: docData.order ?? 0
        };
      }) as Roadmap[];
      
      // Sort by order
      data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      
      setRoadmaps(data);
      
      // Select first roadmap if none selected
      if (data.length > 0 && !currentRoadmapId) {
        const savedId = localStorage.getItem('currentRoadmapId');
        const visibleData = isAdmin ? data : data.filter(r => r.isVisibleToAll);
        
        if (savedId && visibleData.find(r => r.id === savedId)) {
          setCurrentRoadmapId(savedId);
        } else if (visibleData.length > 0) {
          setCurrentRoadmapId(visibleData[0].id);
        }
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'roadmaps'));

    return () => unsubRoadmaps();
  }, [isAuthReady, currentRoadmapId, isAdmin]);

  useEffect(() => {
    if (!isAuthReady || !currentRoadmapId || isAdmin || roadmaps.length === 0) return;
    
    // If current roadmap becomes hidden for non-admin, switch to first visible
    const current = roadmaps.find(r => r.id === currentRoadmapId);
    if (current && !current.isVisibleToAll) {
      const firstVisible = roadmaps.find(r => r.isVisibleToAll);
      if (firstVisible) {
        setCurrentRoadmapId(firstVisible.id);
      }
    }
  }, [roadmaps, currentRoadmapId, isAdmin, isAuthReady]);

  useEffect(() => {
    if (!isAuthReady || !currentRoadmapId) return;

    localStorage.setItem('currentRoadmapId', currentRoadmapId);

    const current = roadmaps.find(r => r.id === currentRoadmapId);
    if (current) {
      if (current.showSprints !== undefined) setShowSprints(current.showSprints);
      if (current.showMilestoneNames !== undefined) setShowMilestoneNames(current.showMilestoneNames);
      if (current.sprintStartDate) setSprintStartDate(current.sprintStartDate);
    }

    const roadmapRef = doc(db, 'roadmaps', currentRoadmapId);

    const unsubFeatures = onSnapshot(collection(roadmapRef, 'features'), (snapshot) => {
      // Skip updates if we just reordered locally to prevent snapping back
      if (Date.now() - lastReorderTimeRef.current < 3000) return;

      const data = snapshot.docs.map(doc => {
        const docData = doc.data();
        return {
          ...docData,
          id: doc.id,
          startDate: (docData.startDate as Timestamp).toDate(),
          endDate: (docData.endDate as Timestamp).toDate(),
          startSprint: docData.startSprint,
          endSprint: docData.endSprint
        };
      }) as Feature[];
      setFeatures(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `roadmaps/${currentRoadmapId}/features`));

    const unsubMembers = onSnapshot(collection(roadmapRef, 'teamMembers'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as TeamMember[];
      setTeamMembers(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `roadmaps/${currentRoadmapId}/teamMembers`));

    const unsubLeaves = onSnapshot(collection(roadmapRef, 'leaves'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        startDate: (doc.data().startDate as Timestamp).toDate(),
        endDate: (doc.data().endDate as Timestamp).toDate()
      })) as Leave[];
      setLeaves(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `roadmaps/${currentRoadmapId}/leaves`));

    const unsubMilestones = onSnapshot(collection(roadmapRef, 'milestones'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        date: (doc.data().date as Timestamp).toDate()
      })) as Milestone[];
      setMilestones(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `roadmaps/${currentRoadmapId}/milestones`));

    return () => {
      unsubFeatures();
      unsubMembers();
      unsubLeaves();
      unsubMilestones();
    };
  }, [isAuthReady, currentRoadmapId, roadmaps]);

  const updateSettings = async (updates: Partial<GanttSettings>) => {
    if (!isAdmin || !currentRoadmapId) return;
    
    const firestoreUpdates: any = {};
    if (updates.title !== undefined) firestoreUpdates.name = updates.title;
    if (updates.subtitle !== undefined) firestoreUpdates.description = updates.subtitle;
    if (updates.sprintStartDate) firestoreUpdates.sprintStartDate = Timestamp.fromDate(updates.sprintStartDate);
    
    try {
      await updateDoc(doc(db, 'roadmaps', currentRoadmapId), firestoreUpdates);
      toast.success("Paramètres mis à jour");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `roadmaps/${currentRoadmapId}`);
    }
  };

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const timelineMonths = useMemo(() => {
    if (focusedSprint) return [];
    const start = startOfMonth(viewStartDate);
    const end = endOfMonth(viewEndDate);
    return eachMonthOfInterval({ start, end });
  }, [viewStartDate, viewEndDate, focusedSprint]);

  const timelineStart = useMemo(() => {
    if (focusedSprint) return focusedSprint.start;
    return startOfMonth(timelineMonths[0]);
  }, [timelineMonths, focusedSprint]);

  const timelineEnd = useMemo(() => {
    if (focusedSprint) return startOfDay(focusedSprint.end);
    if (timelineMonths.length === 0) return startOfDay(new Date());
    return startOfDay(endOfMonth(timelineMonths[timelineMonths.length - 1]));
  }, [timelineMonths, focusedSprint]);

  const totalDays = useMemo(() => {
    return differenceInCalendarDays(timelineEnd, timelineStart) + 1;
  }, [timelineStart, timelineEnd]);

  const holidaysForTimeline = useMemo(() => {
    const years = new Set<number>();
    for (let i = 0; i < totalDays; i++) {
      years.add(addDays(timelineStart, i).getFullYear());
    }
    const allHolidays: { date: Date; name: string }[] = [];
    years.forEach(year => {
      allHolidays.push(...getFrenchPublicHolidays(year));
    });
    return allHolidays;
  }, [timelineStart, totalDays]);

  const sprints = useMemo(() => {
    if (!showSprints) return [];
    const sprintList = [];
    
    // Reference point for "Sprint 1"
    const referenceStart = sprintStartDate;
    
    // Calculate the offset from the reference start to the timeline start
    const daysDiff = differenceInCalendarDays(timelineStart, referenceStart);
    const offset = Math.floor(daysDiff / 21);
    
    let currentSprintStart = addDays(referenceStart, offset * 21);
    let currentSprintNumber = offset + 1;

    // Generate sprints until we pass the end of the timeline
    while (currentSprintStart < timelineEnd) {
      const currentSprintEnd = addDays(currentSprintStart, 20); // 21 days total
      if (currentSprintEnd >= timelineStart) {
        sprintList.push({
          start: currentSprintStart,
          end: currentSprintEnd,
          id: format(currentSprintStart, 'yyyy-MM-dd'),
          number: currentSprintNumber
        });
      }
      currentSprintStart = addDays(currentSprintStart, 21);
      currentSprintNumber++;
    }
    return sprintList;
  }, [showSprints, sprintStartDate, timelineStart, timelineEnd]);

  const getSprintDates = useCallback((sprintNumber: number) => {
    const start = addDays(sprintStartDate, (sprintNumber - 1) * 21);
    const end = addDays(start, 20);
    return { start, end };
  }, [sprintStartDate]);

  const getSprintForDate = useCallback((date: Date) => {
    const daysDiff = differenceInCalendarDays(date, sprintStartDate);
    return Math.floor(daysDiff / 21) + 1;
  }, [sprintStartDate]);

  const snapDateToSprint = useCallback((date: Date, type: 'start' | 'end') => {
    if (!showSprints) return date;
    const sprintNum = getSprintForDate(date);
    const { start, end } = getSprintDates(sprintNum);
    return type === 'start' ? start : end;
  }, [showSprints, getSprintForDate, getSprintDates]);

  const sprintOptions = useMemo(() => {
    return Array.from({ length: 100 }, (_, i) => i + 1);
  }, []);

  const addRoadmap = async () => {
    if (!isAdmin || !user) return;
    const id = Math.random().toString(36).substr(2, 9);
    const newRoadmap = {
      name: 'Nouvelle Roadmap',
      description: 'Description de la roadmap',
      sprintStartDate: Timestamp.fromDate(new Date(2026, 2, 2)),
      viewStartDate: Timestamp.fromDate(viewStartDate),
      viewEndDate: Timestamp.fromDate(viewEndDate),
      showSprints: true,
      ownerId: user.uid,
      createdAt: Timestamp.fromDate(new Date()),
      order: roadmaps.length,
      isVisibleToAll: true
    };
    try {
      await setDoc(doc(db, 'roadmaps', id), newRoadmap);
      toast.success("Roadmap créée avec succès");
      setCurrentRoadmapId(id);
      setEditingRoadmap({ 
        id, 
        name: newRoadmap.name,
        description: newRoadmap.description,
        sprintStartDate: new Date(2026, 2, 2), 
        viewStartDate: viewStartDate,
        viewEndDate: viewEndDate,
        showSprints: true,
        showMilestoneNames: true,
        ownerId: user.uid,
        createdAt: new Date() 
      });
      setIsRoadmapModalOpen(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'roadmaps');
    }
  };

  const reorderRoadmaps = async (newRoadmaps: Roadmap[]) => {
    if (!isAdmin) return;
    setRoadmaps(newRoadmaps);
    
    const batch = writeBatch(db);
    newRoadmaps.forEach((r, index) => {
      batch.update(doc(db, 'roadmaps', r.id), { order: index });
    });
    
    try {
      await batch.commit();
    } catch (error) {
      console.error("Error reordering roadmaps:", error);
      handleFirestoreError(error, OperationType.UPDATE, 'roadmaps/reorder');
    }
  };

  const duplicateRoadmap = async (roadmap: Roadmap) => {
    if (!isAdmin || !user) return;
    
    const toastId = toast.loading(`Duplication de "${roadmap.name}"...`);
    const newId = Math.random().toString(36).substr(2, 9);
    
    try {
      // 1. Duplicate the roadmap document
      const newRoadmap = {
        ...roadmap,
        name: `${roadmap.name} (Copie)`,
        createdAt: Timestamp.fromDate(new Date()),
        ownerId: user.uid
      };
      // Remove id from data
      const { id: _, ...roadmapData } = newRoadmap;
      
      // Convert dates back to Timestamps for Firestore
      const finalRoadmapData = {
        ...roadmapData,
        sprintStartDate: Timestamp.fromDate(roadmap.sprintStartDate),
        viewStartDate: roadmap.viewStartDate ? Timestamp.fromDate(roadmap.viewStartDate) : null,
        viewEndDate: roadmap.viewEndDate ? Timestamp.fromDate(roadmap.viewEndDate) : null,
        createdAt: Timestamp.fromDate(new Date())
      };

      await setDoc(doc(db, 'roadmaps', newId), finalRoadmapData);

      // 2. Duplicate sub-collections
      const roadmapRef = doc(db, 'roadmaps', roadmap.id);
      const newRoadmapRef = doc(db, 'roadmaps', newId);

      const subCollections = ['features', 'milestones', 'teamMembers', 'leaves'];
      
      for (const subColl of subCollections) {
        const snapshot = await getDocs(collection(roadmapRef, subColl));
        const batch = writeBatch(db);
        
        snapshot.docs.forEach(subDoc => {
          const data = subDoc.data();
          const newSubDocRef = doc(collection(newRoadmapRef, subColl), subDoc.id);
          batch.set(newSubDocRef, data);
        });
        
        await batch.commit();
      }

      toast.success("Roadmap dupliquée avec succès", { id: toastId });
      setCurrentRoadmapId(newId);
    } catch (error) {
      console.error("Error duplicating roadmap:", error);
      toast.error("Erreur lors de la duplication", { id: toastId });
      handleFirestoreError(error, OperationType.CREATE, `roadmaps/${roadmap.id}/duplicate`);
    }
  };

  const removeRoadmap = async (id: string) => {
    if (!isAdmin) return;
    if (roadmaps.length <= 1) {
      alert("Vous devez garder au moins une roadmap.");
      return;
    }
    try {
      await deleteDoc(doc(db, 'roadmaps', id));
      if (currentRoadmapId === id) {
        setCurrentRoadmapId(roadmaps.find(r => r.id !== id)?.id || null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'roadmaps');
    }
  };

  const addFeature = async (startDate?: Date, endDate?: Date) => {
    if (!isAdmin || !currentRoadmapId) return;
    
    let start = startDate || startOfDay(viewStartDate);
    let end = endDate || addDays(start, 30);
    
    let startSprintNum: number | undefined;
    let endSprintNum: number | undefined;

    if (showSprints) {
      startSprintNum = getSprintForDate(start);
      endSprintNum = getSprintForDate(end);
      const sprintStart = getSprintDates(startSprintNum);
      const sprintEnd = getSprintDates(endSprintNum);
      start = sprintStart.start;
      end = sprintEnd.end;
    }

    const id = "temp-" + Math.random().toString(36).substr(2, 9);
    const newFeatureData = {
      id,
      name: 'Nouvelle fonctionnalité',
      description: '',
      startDate: start,
      endDate: end,
      color: COLORS[Math.floor(Math.random() * COLORS.length)].bg,
      order: features.length,
      priority: 3,
      startSprint: startSprintNum,
      endSprint: endSprintNum,
      isNew: true
    };
    
    setEditingFeature(newFeatureData);
    setIsFeatureModalOpen(true);
  };

  const reorderFeatures = (newFeatures: Feature[]) => {
    if (!isAdmin) return;
    lastReorderTimeRef.current = Date.now();
    setFeatures(newFeatures);
  };

  // Sync features order to Firestore when they change
  useEffect(() => {
    if (!isAdmin || !isAuthReady || !currentRoadmapId) return;
    
    const syncOrder = async () => {
      const batch = writeBatch(db);
      let hasUpdates = false;

      features.forEach((f, index) => {
        if (f.order !== index) {
          batch.update(doc(db, 'roadmaps', currentRoadmapId, 'features', f.id), { order: index });
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        try {
          await batch.commit();
        } catch (error) {
          console.error("Failed to sync features order:", error);
        }
      }
    };

    const timer = setTimeout(syncOrder, 2000); // Debounce sync
    return () => clearTimeout(timer);
  }, [features, isAdmin, isAuthReady, currentRoadmapId]);

  const removeFeature = async (id: string) => {
    if (!isAdmin || !currentRoadmapId) return;
    if (id.startsWith('temp-')) {
      setEditingFeature(null);
      return;
    }
    try {
      await deleteDoc(doc(db, 'roadmaps', currentRoadmapId, 'features', id));
      toast.success("Fonctionnalité supprimée");
      if (editingFeature?.id === id) {
        setEditingFeature(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `roadmaps/${currentRoadmapId}/features`);
    }
  };

  const updateFeature = async (id: string, updates: Partial<Feature>, persist = true) => {
    if (!isAdmin || !currentRoadmapId) return;
    
    // Update local features list
    setFeatures(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));

    if (editingFeature?.id === id) {
      setEditingFeature(prev => prev ? { ...prev, ...updates } : null);
    }
    if (resizingFeature?.id === id) {
      setResizingFeature(prev => prev ? { ...prev, ...updates } : null);
    }
    if (movingFeature?.id === id) {
      setMovingFeature(prev => prev ? { ...prev, ...updates } : null);
    }

    if (!persist || id.startsWith('temp-')) return;

    const firestoreUpdates: any = {};
    if (updates.name !== undefined) firestoreUpdates.name = updates.name;
    if (updates.description !== undefined) firestoreUpdates.description = updates.description || '';
    if (updates.startDate !== undefined) firestoreUpdates.startDate = Timestamp.fromDate(updates.startDate);
    if (updates.endDate !== undefined) firestoreUpdates.endDate = Timestamp.fromDate(updates.endDate);
    if (updates.color !== undefined) firestoreUpdates.color = updates.color;
    if (updates.priority !== undefined) firestoreUpdates.priority = updates.priority;
    if (updates.order !== undefined) firestoreUpdates.order = updates.order;
    
    // Auto-update sprints if dates change and showSprints is enabled
    if (showSprints) {
      if (updates.startDate !== undefined && updates.startSprint === undefined) {
        updates.startSprint = getSprintForDate(updates.startDate);
        firestoreUpdates.startSprint = updates.startSprint;
      }
      if (updates.endDate !== undefined && updates.endSprint === undefined) {
        updates.endSprint = getSprintForDate(updates.endDate);
        firestoreUpdates.endSprint = updates.endSprint;
      }
    }

    // Handle sprint fields explicitly
    if (updates.startSprint !== undefined) {
      firestoreUpdates.startSprint = updates.startSprint === null ? deleteField() : updates.startSprint;
    }
    if (updates.endSprint !== undefined) {
      firestoreUpdates.endSprint = updates.endSprint === null ? deleteField() : updates.endSprint;
    }

    try {
      await updateDoc(doc(db, 'roadmaps', currentRoadmapId, 'features', id), firestoreUpdates);
      if (persist) {
        toast.success("Fonctionnalité mise à jour");
      }
    } catch (error) {
      console.error("Error updating feature:", error);
      toast.error("Erreur lors de la mise à jour");
      handleFirestoreError(error, OperationType.UPDATE, `roadmaps/${currentRoadmapId}/features/${id}`);
    }
  };

  const createTeamMember = async (name: string) => {
    if (!isAdmin || !currentRoadmapId) return null;
    const id = Math.random().toString(36).substr(2, 9);
    const newMember = {
      name,
      color: COLORS[Math.floor(Math.random() * COLORS.length)].bg
    };
    try {
      await setDoc(doc(db, 'roadmaps', currentRoadmapId, 'teamMembers', id), newMember);
      return { id, ...newMember };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `roadmaps/${currentRoadmapId}/teamMembers`);
      return null;
    }
  };

  const addTeamMember = async () => {
    const member = await createTeamMember('Nouveau membre');
    if (member) {
      toast.success("Membre de l'équipe ajouté");
      setEditingMember(member);
      setIsTeamModalOpen(true);
    }
  };

  const removeTeamMember = async (id: string) => {
    if (!isAdmin || !currentRoadmapId) return;
    try {
      await deleteDoc(doc(db, 'roadmaps', currentRoadmapId, 'teamMembers', id));
      const memberLeaves = leaves.filter(l => l.memberId === id);
      for (const leave of memberLeaves) {
        await deleteDoc(doc(db, 'roadmaps', currentRoadmapId, 'leaves', leave.id));
      }
      toast.success("Membre de l'équipe supprimé");
      if (editingMember?.id === id) {
        setEditingMember(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `roadmaps/${currentRoadmapId}/teamMembers`);
    }
  };

  const updateTeamMember = async (id: string, updates: Partial<TeamMember>, persist = true) => {
    if (!isAdmin || !currentRoadmapId) return;
    
    if (editingMember?.id === id) {
      setEditingMember({ ...editingMember, ...updates });
    }

    if (!persist) return;

    try {
      await updateDoc(doc(db, 'roadmaps', currentRoadmapId, 'teamMembers', id), updates);
      if (persist) {
        toast.success("Membre de l'équipe mis à jour avec succès");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `roadmaps/${currentRoadmapId}/teamMembers`);
    }
  };

  const addMilestone = (date?: Date) => {
    if (!isAdmin || !currentRoadmapId) return;
    const id = "new_" + Math.random().toString(36).substr(2, 9);
    const newMilestone = {
      id,
      name: 'Nouveau jalon',
      description: '',
      date: date || startOfDay(viewStartDate),
      color: 'bg-rose-500'
    };
    setEditingMilestone(newMilestone);
    setIsMilestoneModalOpen(true);
  };

  const removeMilestone = async (id: string) => {
    if (!isAdmin || !currentRoadmapId) return;
    try {
      await deleteDoc(doc(db, 'roadmaps', currentRoadmapId, 'milestones', id));
      toast.success("Jalon supprimé");
      if (editingMilestone?.id === id) {
        setEditingMilestone(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `roadmaps/${currentRoadmapId}/milestones`);
    }
  };

  const updateMilestone = async (id: string, updates: Partial<Milestone>, persist = true) => {
    if (!isAdmin || !currentRoadmapId) return;
    
    if (editingMilestone?.id === id) {
      setEditingMilestone({ ...editingMilestone, ...updates });
    }

    if (!persist) return;

    const firestoreUpdates: any = { ...updates };
    if (updates.date) firestoreUpdates.date = Timestamp.fromDate(updates.date);
    
    try {
      if (id.startsWith('new_')) {
        const realId = Math.random().toString(36).substr(2, 9);
        const newMilestone = {
          name: updates.name || 'Nouveau jalon',
          description: updates.description || '',
          date: Timestamp.fromDate(updates.date || new Date()),
          color: updates.color || 'bg-rose-500'
        };
        await setDoc(doc(db, 'roadmaps', currentRoadmapId, 'milestones', realId), newMilestone);
        toast.success("Jalon ajouté");
      } else {
        await updateDoc(doc(db, 'roadmaps', currentRoadmapId, 'milestones', id), firestoreUpdates);
        toast.success("Jalon mis à jour");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `roadmaps/${currentRoadmapId}/milestones`);
    }
  };

  const addLeave = (memberId?: string, startDate?: Date, endDate?: Date) => {
    if (!isAdmin || !currentRoadmapId) return;
    const id = "new_" + Math.random().toString(36).substr(2, 9);
    const start = startDate || viewStartDate;
    const end = endDate || addDays(start, 7);
    const finalMemberId = memberId || (teamMembers.length > 0 ? teamMembers[0].id : '');
    
    setEditingLeave({ 
      id, 
      memberId: finalMemberId, 
      startDate: startOfDay(start), 
      endDate: startOfDay(end), 
      label: 'Congés' 
    });
    setIsLeaveModalOpen(true);
  };

  const removeLeave = async (id: string) => {
    if (!isAdmin || !currentRoadmapId) return;
    try {
      await deleteDoc(doc(db, 'roadmaps', currentRoadmapId, 'leaves', id));
      toast.success("Période de congés supprimée");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `roadmaps/${currentRoadmapId}/leaves`);
    }
  };

  const updateLeave = async (id: string, updates: Partial<Leave>, persist = true) => {
    if (!isAdmin || !currentRoadmapId) return;
    
    if (!persist) {
      setLeaves(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
      return;
    }

    const firestoreUpdates: any = { ...updates };
    if (updates.startDate) firestoreUpdates.startDate = Timestamp.fromDate(updates.startDate);
    if (updates.endDate) firestoreUpdates.endDate = Timestamp.fromDate(updates.endDate);
    
    try {
      if (id.startsWith('new_')) {
        const realId = Math.random().toString(36).substr(2, 9);
        const newLeave = {
          memberId: updates.memberId || '',
          startDate: Timestamp.fromDate(updates.startDate || new Date()),
          endDate: Timestamp.fromDate(updates.endDate || new Date()),
          label: updates.label || 'Congés'
        };
        await setDoc(doc(db, 'roadmaps', currentRoadmapId, 'leaves', realId), newLeave);
        toast.success("Période de congés ajoutée");
      } else {
        await updateDoc(doc(db, 'roadmaps', currentRoadmapId, 'leaves', id), firestoreUpdates);
        toast.success("Période de congés mise à jour");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `roadmaps/${currentRoadmapId}/leaves`);
    }
  };

  const handleTimelineMouseDown = (e: React.MouseEvent, type: 'feature' | 'leave' | 'milestone' = 'feature', memberId?: string) => {
    if (!isAdmin) return;
    if (e.button !== 0) return; // Only left click
    const rect = ganttRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const style = window.getComputedStyle(ganttRef.current!);
    const paddingLeft = parseFloat(style.paddingLeft);
    const paddingRight = parseFloat(style.paddingRight);
    
    const x = e.clientX - rect.left;
    const timelineWidth = rect.width - paddingLeft - paddingRight;
    const timelineX = x - paddingLeft;
    
    // Only allow selection in the timeline area
    if (timelineX < 0) return;

    const percentage = Math.max(0, Math.min(1, timelineX / timelineWidth));
    const daysOffset = Math.floor(percentage * totalDays);
    let clickedDate = addDays(timelineStart, daysOffset);
    if (showSprints && type === 'feature') {
      clickedDate = snapDateToSprint(clickedDate, 'start');
    }
    
    setSelectionRange({ start: clickedDate, end: clickedDate });
    setIsSelecting(true);
    setSelectionType(type);
    setSelectionMemberId(memberId || null);
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleResizeStart = (e: React.MouseEvent, feature: Feature, handle: 'start' | 'end') => {
    if (!isAdmin) return;
    e.stopPropagation();
    setResizingFeature(feature);
    setResizeHandle(handle);
  };

  const handleMoveStart = (e: React.MouseEvent, feature: Feature) => {
    if (!isAdmin || !ganttRef.current) return;
    e.stopPropagation();
    
    const rect = ganttRef.current.getBoundingClientRect();
    const style = window.getComputedStyle(ganttRef.current);
    const paddingLeft = parseFloat(style.paddingLeft);
    const paddingRight = parseFloat(style.paddingRight);
    const timelineWidth = rect.width - paddingLeft - paddingRight;
    const timelineX = e.clientX - rect.left - paddingLeft;
    
    const percentage = Math.max(0, Math.min(1, timelineX / timelineWidth));
    const daysOffset = Math.floor(percentage * totalDays);
    const currentDate = addDays(timelineStart, daysOffset);
    
    const offset = differenceInDays(currentDate, feature.startDate);
    setMovingFeature(feature);
    setMoveStartOffset(offset);
  };

  const handleTimelineMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    const rect = ganttRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const style = window.getComputedStyle(ganttRef.current!);
    const paddingLeft = parseFloat(style.paddingLeft);
    const paddingRight = parseFloat(style.paddingRight);
    
    const x = e.clientX - rect.left;
    const timelineWidth = rect.width - paddingLeft - paddingRight;
    const timelineX = x - paddingLeft;
    
    // Hide tooltip if over sidebar
    if (timelineX < 0 && !isSelecting && !resizingFeature && !movingFeature) {
      setHoverType(null);
      setHoveredFeature(null);
      setHoveredLeave(null);
    }

    const percentage = Math.max(0, Math.min(1, timelineX / timelineWidth));
    const daysOffset = Math.floor(percentage * totalDays);
    const currentDate = addDays(timelineStart, daysOffset);
    setHoverDate(currentDate);

    if (isSelectingView && viewSelectionRange) {
      const sprintNum = getSprintForDate(currentDate);
      const sprint = getSprintDates(sprintNum);
      if (sprint.start.getTime() !== viewSelectionRange.start.getTime()) {
        setDragOccurred(true);
      }
      setViewSelectionRange({ ...viewSelectionRange, end: sprint.end });
      return;
    }

    if (resizingFeature && resizeHandle) {
      let snappedDate = currentDate;
      if (showSprints) {
        snappedDate = snapDateToSprint(currentDate, resizeHandle);
      }
      
      if (resizeHandle === 'start') {
        const newStart = snappedDate < resizingFeature.endDate ? snappedDate : subDays(resizingFeature.endDate, 1);
        const updates: Partial<Feature> = { startDate: newStart };
        if (showSprints) {
          updates.startSprint = getSprintForDate(newStart);
        }
        updateFeature(resizingFeature.id, updates, false);
      } else {
        const newEnd = snappedDate > resizingFeature.startDate ? snappedDate : addDays(resizingFeature.startDate, 1);
        const updates: Partial<Feature> = { endDate: newEnd };
        if (showSprints) {
          updates.endSprint = getSprintForDate(newEnd);
        }
        updateFeature(resizingFeature.id, updates, false);
      }
      return;
    }

    if (movingFeature) {
      const duration = differenceInDays(movingFeature.endDate, movingFeature.startDate);
      let newStart = addDays(currentDate, -moveStartOffset);
      if (showSprints) {
        newStart = snapDateToSprint(newStart, 'start');
      }
      const newEnd = addDays(newStart, duration);
      const updates: Partial<Feature> = { startDate: newStart, endDate: newEnd };
      if (showSprints) {
        updates.startSprint = getSprintForDate(newStart);
        updates.endSprint = getSprintForDate(newEnd);
      }
      updateFeature(movingFeature.id, updates, false);
      return;
    }

    if (!isSelecting || !selectionRange) return;
    let end = currentDate;
    if (showSprints && selectionType === 'feature') {
      end = snapDateToSprint(currentDate, 'end');
    }
    setSelectionRange({ ...selectionRange, end });
  };

  const handleTimelineMouseUp = () => {
    if (isSelectingView) {
      handleSprintMouseUp();
      return;
    }

    if (resizingFeature) {
      updateFeature(resizingFeature.id, resizingFeature, true);
      setResizingFeature(null);
      setResizeHandle(null);
      return;
    }

    if (movingFeature) {
      updateFeature(movingFeature.id, movingFeature, true);
      setMovingFeature(null);
      setMoveStartOffset(0);
      return;
    }

    if (!isSelecting || !selectionRange) return;
    setIsSelecting(false);
    
    let start = selectionRange.start < selectionRange.end ? selectionRange.start : selectionRange.end;
    let end = selectionRange.start < selectionRange.end ? selectionRange.end : selectionRange.start;
    
    if (showSprints && selectionType === 'feature') {
      start = snapDateToSprint(start, 'start');
      end = snapDateToSprint(end, 'end');
    }
    
    if (selectionType === 'feature') {
      if (differenceInDays(end, start) < 1) {
        addFeature(start);
      } else {
        addFeature(start, end);
      }
    } else if (selectionType === 'leave') {
      addLeave(selectionMemberId || undefined, start, end);
    } else if (selectionType === 'milestone') {
      addMilestone(start);
    }
    
    setSelectionRange(null);
    setSelectionType(null);
    setSelectionMemberId(null);
  };

  const handleSprintMouseDown = (e: React.MouseEvent, sprint: { start: Date, end: Date, number: number }) => {
    e.stopPropagation();
    setIsSelectingView(true);
    setDragOccurred(false);
    setViewSelectionRange({ start: sprint.start, end: sprint.end });
  };

  const handleSprintMouseEnter = (sprint: { start: Date, end: Date, number: number }) => {
    if (isSelectingView && viewSelectionRange) {
      if (sprint.start.getTime() !== viewSelectionRange.start.getTime()) {
        setDragOccurred(true);
      }
      setViewSelectionRange({ ...viewSelectionRange, end: sprint.end });
    }
  };

  const handleSprintMouseUp = () => {
    if (isSelectingView && viewSelectionRange) {
      if (dragOccurred) {
        const s = viewSelectionRange.start < viewSelectionRange.end ? viewSelectionRange.start : getSprintDates(getSprintForDate(viewSelectionRange.end)).start;
        const e = viewSelectionRange.start < viewSelectionRange.end ? viewSelectionRange.end : getSprintDates(getSprintForDate(viewSelectionRange.start)).end;
        
        setViewStartDate(s);
        setViewEndDate(e);
        setFocusedSprint(null);
      }
    }
    setIsSelectingView(false);
    setViewSelectionRange(null);
  };

  const exportAsPng = async () => {
    if (ganttRef.current === null) return;
    
    try {
      const dataUrl = await toPng(ganttRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        style: {
          padding: '40px',
          borderRadius: '0'
        }
      });
      const link = document.createElement('a');
      link.download = `macro-gantt-${format(new Date(), 'yyyy-MM-dd')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const getPosition = (date: Date, precise = false) => {
    if (precise) {
      const start = timelineStart.getTime();
      const end = timelineEnd.getTime() + (24 * 60 * 60 * 1000);
      const current = date.getTime();
      return ((current - start) / (end - start)) * 100;
    }
    const diff = differenceInCalendarDays(date, timelineStart);
    const pos = (diff / totalDays) * 100;
    return pos;
  };

  const displayedRoadmaps = useMemo(() => {
    if (isAdmin) return roadmaps;
    return roadmaps.filter(r => r.isVisibleToAll);
  }, [roadmaps, isAdmin]);

  const getDateFromPosition = (percentage: number) => {
    const days = (percentage / 100) * totalDays;
    return addDays(timelineStart, Math.floor(days));
  };

  const filteredMembers = useMemo(() => {
    if (focusedSprint) {
      // In sprint view, we show all members to see the full team capacity
      return teamMembers;
    }
    // In roadmap view, we only show members who have at least one leave to avoid cluttering
    return teamMembers.filter(member => leaves.some(l => l.memberId === member.id));
  }, [teamMembers, leaves, focusedSprint]);

  return (
    <Tooltip.Provider>
      <div className="h-screen bg-[#F8F9FA] text-slate-900 font-sans selection:bg-indigo-100 flex flex-col overflow-hidden">
        {/* Header */}
      <header className="shrink-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <LayoutGrid className="text-white w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">MacroGantt</h1>
                <Popover.Root>
                  <Popover.Trigger asChild>
                    <button className="p-1 hover:bg-slate-100 rounded transition-all text-slate-400 hover:text-indigo-600">
                      <ChevronDown size={14} />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content className="w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-200" sideOffset={5} align="start">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Mes Roadmaps</h3>
                      <div className="max-h-60 overflow-y-auto custom-scrollbar pr-1">
                        {isAdmin ? (
                          <Reorder.Group axis="y" values={roadmaps} onReorder={reorderRoadmaps} className="space-y-1">
                            {roadmaps.map(roadmap => (
                              <Reorder.Item 
                                key={roadmap.id} 
                                value={roadmap}
                                className="flex items-center gap-1 group"
                              >
                                <div className="p-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity">
                                  <MoreVertical size={12} className="text-slate-300" />
                                </div>
                                <button
                                  onClick={() => setCurrentRoadmapId(roadmap.id)}
                                  className={cn(
                                    "flex-1 text-left px-3 py-2 rounded-lg text-xs font-bold transition-all truncate flex items-center justify-between",
                                    currentRoadmapId === roadmap.id 
                                      ? "bg-indigo-50 text-indigo-700" 
                                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                  )}
                                >
                                  <span className="truncate">{roadmap.name}</span>
                                  {!roadmap.isVisibleToAll && (
                                    <X size={10} className="text-slate-400 shrink-0" title="Masqué pour les non-admins" />
                                  )}
                                </button>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      duplicateRoadmap(roadmap);
                                    }}
                                    className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Dupliquer"
                                  >
                                    <Copy size={14} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingRoadmap(roadmap);
                                      setIsRoadmapModalOpen(true);
                                    }}
                                    className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                    title="Paramètres"
                                  >
                                    <Settings size={14} />
                                  </button>
                                </div>
                              </Reorder.Item>
                            ))}
                          </Reorder.Group>
                        ) : (
                          <div className="space-y-1">
                            {displayedRoadmaps.map(roadmap => (
                              <div key={roadmap.id} className="flex items-center gap-1 group">
                                <button
                                  onClick={() => setCurrentRoadmapId(roadmap.id)}
                                  className={cn(
                                    "flex-1 text-left px-3 py-2 rounded-lg text-xs font-bold transition-all truncate",
                                    currentRoadmapId === roadmap.id 
                                      ? "bg-indigo-50 text-indigo-700" 
                                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                  )}
                                >
                                  {roadmap.name}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <button 
                            onClick={addRoadmap}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          >
                            <Plus size={14} />
                            Nouvelle Roadmap
                          </button>
                        </div>
                      )}
                      <Popover.Arrow className="fill-white" />
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </div>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest leading-none">{currentRoadmap?.name || 'Studio 2026'}</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div className="flex flex-col">
            {isAdmin ? (
              <div className="flex flex-col">
                <input 
                  type="text"
                  value={focusedSprint ? `Focus Sprint ${focusedSprint.number}` : title}
                  disabled={!!focusedSprint}
                  onChange={(e) => {
                    if (!focusedSprint) {
                      setTitle(e.target.value);
                    }
                  }}
                  onBlur={(e) => {
                    if (!focusedSprint) {
                      updateSettings({ title: e.target.value });
                    }
                  }}
                  className={cn(
                    "text-sm font-black text-slate-900 tracking-tight bg-transparent border-none p-0 focus:ring-0 w-48 h-4",
                    focusedSprint && "opacity-50"
                  )}
                />
                <input 
                  type="text"
                  value={focusedSprint 
                    ? `Période du ${format(focusedSprint.start, 'dd MMMM', { locale: fr })} au ${format(focusedSprint.end, 'dd MMMM yyyy', { locale: fr })}`
                    : subtitle}
                  disabled={!!focusedSprint}
                  onChange={(e) => {
                    if (!focusedSprint) {
                      setSubtitle(e.target.value);
                    }
                  }}
                  onBlur={(e) => {
                    if (!focusedSprint) {
                      updateSettings({ subtitle: e.target.value });
                    }
                  }}
                  className={cn(
                    "text-[9px] text-slate-500 font-medium bg-transparent border-none p-0 focus:ring-0 w-48 h-3",
                    focusedSprint && "opacity-50"
                  )}
                />
              </div>
            ) : (
              <div className="flex flex-col">
                <h2 className="text-sm font-black text-slate-900 tracking-tight leading-none">
                  {focusedSprint ? `Focus Sprint ${focusedSprint.number}` : title}
                </h2>
                <p className="text-[9px] text-slate-500 font-medium leading-none mt-0.5">
                  {focusedSprint 
                    ? `Période du ${format(focusedSprint.start, 'dd MMMM', { locale: fr })} au ${format(focusedSprint.end, 'dd MMMM yyyy', { locale: fr })}`
                    : subtitle}
                </p>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {isAdmin && (
            <nav className="flex items-center gap-1.5">
              {/* Navigation buttons removed as requested */}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {focusedSprint ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 mr-1">
                <button 
                  onClick={() => {
                    const prev = getSprintDates(focusedSprint.number - 1);
                    setFocusedSprint({ ...prev, number: focusedSprint.number - 1 });
                  }}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                  title="Sprint précédent"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Sprint {focusedSprint.number}
                </span>
                <button 
                  onClick={() => {
                    const next = getSprintDates(focusedSprint.number + 1);
                    setFocusedSprint({ ...next, number: focusedSprint.number + 1 });
                  }}
                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                  title="Sprint suivant"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <button 
                onClick={() => setFocusedSprint(null)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all font-bold text-xs"
              >
                <LayoutGrid size={14} />
                Retour Vue Macro
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
              <div className="flex items-center gap-2 px-2">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Début</span>
                  <input 
                    type="date" 
                    value={format(viewStartDate, 'yyyy-MM-dd')}
                    onChange={(e) => setViewStartDate(new Date(e.target.value))}
                    className="bg-transparent text-[10px] font-bold outline-none text-slate-600"
                  />
                </div>
                <div className="h-4 w-px bg-slate-300 mx-1" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Fin</span>
                  <input 
                    type="date" 
                    value={format(viewEndDate, 'yyyy-MM-dd')}
                    onChange={(e) => setViewEndDate(new Date(e.target.value))}
                    className="bg-transparent text-[10px] font-bold outline-none text-slate-600"
                  />
                </div>
              </div>
            </div>
          )}


          <div className="h-4 w-px bg-slate-200 mx-1" />

          {(user || (typeof window !== 'undefined' && window.location.search.includes('admin'))) && (
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold text-slate-900 leading-none">{user.displayName || user.email}</span>
                    <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest mt-1">
                      {isAdmin ? 'Administrateur' : 'Consultation'}
                    </span>
                  </div>
                  <button 
                    onClick={logout}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    title="Se déconnecter"
                  >
                    <LogOut size={18} />
                  </button>
                </>
              ) : (
                <button 
                  onClick={login}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-bold text-xs shadow-lg shadow-indigo-200"
                >
                  <LogIn size={14} />
                  Connexion Admin
                </button>
              )}
            </div>
          )}

          {isAdmin && (
            <>
              <div className="h-4 w-px bg-slate-200 mx-1" />
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all">
                    <Settings2 size={20} />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content className="w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 z-50 animate-in fade-in zoom-in-95 duration-200" sideOffset={10} align="end">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Configuration</h3>
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Afficher Sprints</label>
                        <Switch.Root 
                          checked={showSprints} 
                          onCheckedChange={(checked) => setShowSprints(checked)}
                          className="w-8 h-4 bg-slate-200 rounded-full relative data-[state=checked]:bg-indigo-600 transition-colors outline-none cursor-pointer"
                        >
                          <Switch.Thumb className="block w-3 h-3 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[18px]" />
                        </Switch.Root>
                      </div>

                      {showSprints && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Début Cycle</label>
                          <input 
                            type="date"
                            disabled={!isAdmin}
                            value={format(sprintStartDate, 'yyyy-MM-dd')}
                            onChange={(e) => updateSettings({ sprintStartDate: new Date(e.target.value) })}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>
                      )}
                    </div>
                    <Popover.Arrow className="fill-white" />
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </>
          )}

          <button 
            onClick={exportAsPng}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all font-bold text-xs shadow-lg shadow-slate-200"
          >
            <Download size={14} />
            PNG
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-auto custom-scrollbar">
          <div 
            ref={ganttRef}
            className="pl-4 pt-6 pr-4 pb-4 min-w-max"
          >
            <div 
              className={cn("relative", resizingFeature ? "cursor-ew-resize" : "")}
              onMouseMove={handleTimelineMouseMove}
              onMouseUp={handleTimelineMouseUp}
              onMouseLeave={() => {
                setHoverType(null);
                if (isSelecting || resizingFeature) {
                  handleTimelineMouseUp();
                }
              }}
            >
              {/* Selection Background (Handles clicks for new features) */}
              {isAdmin && (
                <div 
                  className={cn(
                    "absolute inset-0 z-0",
                    resizingFeature ? "cursor-ew-resize" : "cursor-crosshair"
                  )}
                  onMouseDown={handleTimelineMouseDown}
                />
              )}

              {/* Sticky Header Section */}
              <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm shadow-sm">
                {/* Timeline Header */}
                <div className="border-b border-slate-200 relative z-10 pointer-events-none">
                  {/* Months Row */}
                  {!focusedSprint && (
                    <div className="flex border-b border-slate-100 pb-1">
                      {timelineMonths.map((month, idx) => {
                        const monthStart = startOfMonth(month);
                        const monthEnd = endOfMonth(month);
                        const daysInMonth = differenceInCalendarDays(monthEnd, monthStart) + 1;
                        const width = (daysInMonth / totalDays) * 100;
                        return (
                          <div 
                            key={idx} 
                            className="text-center border-l border-slate-100 first:border-l-0"
                            style={{ width: `${width}%` }}
                          >
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {format(month, 'MMM', { locale: fr })}
                            </span>
                            <div className="text-[9px] font-bold text-slate-300">
                              {format(month, 'yyyy')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Sprints Row (Horizontal) */}
                  {showSprints && (
                    <div 
                      className={cn("relative bg-slate-50/50 overflow-hidden pointer-events-auto", focusedSprint ? "h-10" : "h-6")}
                      onMouseLeave={() => {
                        if (isSelectingView) handleSprintMouseUp();
                      }}
                    >
                      {focusedSprint ? (
                        <div className="absolute inset-0 flex items-center border-b border-slate-200 bg-indigo-50/50">
                          <div className="flex-1 flex h-full">
                            {Array.from({ length: 21 }).map((_, dayIdx) => {
                              const date = addDays(focusedSprint.start, dayIdx);
                              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                              return (
                                <div key={dayIdx} className={cn("flex-1 flex flex-col justify-center items-center border-l border-indigo-100/30 first:border-l-0", isWeekend ? "bg-slate-100/30 opacity-60" : "")}>
                                  <div className="text-[8px] font-black text-indigo-600 uppercase tracking-tighter">
                                    {format(date, 'EEE', { locale: fr })}
                                  </div>
                                  <div className="text-[10px] text-indigo-900 font-bold">
                                    {format(date, 'dd')}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* View Selection Overlay */}
                          {viewSelectionRange && (
                            <div 
                              className="absolute top-0 bottom-0 bg-indigo-500/20 border-x-2 border-indigo-500/40 z-10 pointer-events-none"
                              style={(() => {
                                const s = viewSelectionRange.start < viewSelectionRange.end ? viewSelectionRange.start : getSprintDates(getSprintForDate(viewSelectionRange.end)).start;
                                const e = viewSelectionRange.start < viewSelectionRange.end ? addDays(viewSelectionRange.end, 1) : addDays(viewSelectionRange.start, 1);
                                const left = getPosition(s);
                                const width = getPosition(e) - left;
                                return { left: `${left}%`, width: `${width}%` };
                              })()}
                            />
                          )}
                          {sprints.map((sprint) => {
                            const startPos = getPosition(sprint.start);
                            const endPos = getPosition(addDays(sprint.end, 1));
                            const width = endPos - startPos;
                            
                            return (
                              <button 
                                key={sprint.id}
                                onMouseDown={(e) => handleSprintMouseDown(e, sprint)}
                                onMouseEnter={() => handleSprintMouseEnter(sprint)}
                                onMouseUp={handleSprintMouseUp}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // If no drag happened, we focus the sprint
                                  if (!dragOccurred) {
                                    setFocusedSprint(sprint);
                                  }
                                }}
                                className={cn(
                                  "absolute top-0 bottom-0 border-r border-slate-200 flex items-center justify-center transition-all hover:bg-indigo-100/50 group/sprint",
                                  sprint.number % 2 === 0 ? "bg-indigo-50/30" : "bg-transparent",
                                  viewSelectionRange && (
                                    (sprint.start >= viewSelectionRange.start && sprint.end <= viewSelectionRange.end) ||
                                    (sprint.start >= viewSelectionRange.end && sprint.end <= viewSelectionRange.start)
                                  ) ? "bg-indigo-500/10" : ""
                                )}
                                style={{ left: `${startPos}%`, width: `${width}%` }}
                              >
                                <span className="text-[9px] font-black text-indigo-600/60 uppercase tracking-tighter group-hover/sprint:text-indigo-600 group-hover/sprint:scale-110 transition-all">
                                  Sprint {sprint.number}
                                </span>
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}

                  {/* French School Holidays (Large bands with Tooltips) */}
                  <div className={cn(
                    "relative border-t border-slate-100 pt-1 bg-slate-50/30 pointer-events-auto",
                    focusedSprint ? "h-[45px]" : "h-[30px]"
                  )}>
                    <div className="h-full flex flex-col justify-between py-0.5 opacity-80">
                      {['A', 'B', 'C'].map((zone) => (
                        <div key={zone} className={cn("relative w-full", focusedSprint ? "h-[12px]" : "h-[6px]")}>
                          {FRENCH_SCHOOL_HOLIDAYS.filter(h => h.zone === zone || h.zone === 'All').map((holiday, hIdx) => {
                            const startPos = getPosition(holiday.start);
                            const endPos = getPosition(holiday.end);
                            
                            const left = Math.max(startPos, 0);
                            const right = Math.min(endPos, 100);
                            const displayWidth = Math.max(right - left, 0);
                            
                            if (displayWidth <= 0) return null;
                            
                            return (
                              <Tooltip.Root key={hIdx}>
                                <Tooltip.Trigger asChild>
                                  <div 
                                    className={cn(
                                      "absolute h-full rounded-sm shadow-sm cursor-default transition-opacity hover:opacity-100",
                                      zone === 'A' ? "bg-rose-400" : zone === 'B' ? "bg-indigo-400" : "bg-emerald-400"
                                    )}
                                    style={{ left: `${left}%`, width: `${displayWidth}%` }}
                                  />
                                </Tooltip.Trigger>
                                <Tooltip.Portal>
                                  <Tooltip.Content 
                                    className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-xl z-50 animate-in fade-in zoom-in-95 duration-200"
                                    sideOffset={5}
                                  >
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-slate-400 uppercase tracking-widest text-[8px]">Zone {holiday.zone === 'All' ? 'A, B, C' : holiday.zone}</span>
                                      <span>{format(holiday.start, 'd MMM', { locale: fr })} - {format(holiday.end, 'd MMM yyyy', { locale: fr })}</span>
                                    </div>
                                    <Tooltip.Arrow className="fill-slate-900" />
                                  </Tooltip.Content>
                                </Tooltip.Portal>
                              </Tooltip.Root>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Milestones Row */}
                <div 
                  onMouseDown={(e) => handleTimelineMouseDown(e, 'milestone')}
                  onMouseEnter={() => setHoverType('milestone')}
                  onMouseLeave={() => setHoverType(null)}
                  className={cn(
                    "relative h-8 border-b border-slate-200/60 flex items-center z-20 transition-all group/milestone-row",
                    isAdmin ? "cursor-crosshair hover:bg-indigo-50/40 bg-slate-50/40 shadow-sm" : "bg-slate-50/10"
                  )}
                >
                  {/* Selection Overlay for Milestones */}
                  {selectionRange && selectionType === 'milestone' && (
                    <div 
                      className="absolute top-0 bottom-0 bg-rose-500/10 border-x border-rose-500/30 z-0 pointer-events-none"
                      style={{ 
                        left: `${getPosition(selectionRange.start < selectionRange.end ? selectionRange.start : selectionRange.end)}%`, 
                        width: `${Math.abs(getPosition(selectionRange.end) - getPosition(selectionRange.start))}%` 
                      }}
                    />
                  )}
                  {isAdmin && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/milestone-row:opacity-100 pointer-events-none transition-opacity">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-white/80 px-3 py-1 rounded-full shadow-sm border border-indigo-100">
                        Cliquez pour ajouter un jalon
                      </span>
                    </div>
                  )}
                  {(() => {
                    const sortedMilestones = [...milestones].sort((a, b) => a.date.getTime() - b.date.getTime());
                    const lastPosAtLevel: number[] = [-20, -20, -20, -20]; // Track last position for each level
                    
                    return sortedMilestones.map(milestone => {
                      const dayWidth = 100 / totalDays;
                      const pos = getPosition(milestone.date) + (dayWidth / 2);
                      const isVisible = pos >= 0 && pos <= 100;
                      if (!isVisible) return null;

                      // Find first level where there's no overlap
                      // Assume a label is roughly 8% of the timeline width
                      const labelWidth = 8; 
                      let level = 0;
                      if (showMilestoneNames) {
                        while (level < 3 && pos < lastPosAtLevel[level] + labelWidth) {
                          level++;
                        }
                        lastPosAtLevel[level] = pos;
                      }

                      return (
                        <div 
                          key={milestone.id}
                          className="absolute top-0 bottom-0 flex flex-col items-center group/milestone z-30"
                          style={{ left: `${pos}%` }}
                        >
                          <div className="h-full w-px bg-slate-200 group-hover/milestone:bg-rose-400 transition-colors" />
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isAdmin) {
                                setEditingMilestone(milestone);
                                setIsMilestoneModalOpen(true);
                              }
                            }}
                            className={cn(
                              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rotate-45 border-2 border-white shadow-md flex items-center justify-center transition-all hover:scale-110 active:scale-95",
                              milestone.color.startsWith('bg-') ? milestone.color : "",
                              !isAdmin && "cursor-default"
                            )}
                            style={!milestone.color.startsWith('bg-') ? { backgroundColor: milestone.color } : {}}
                          >
                            <Flag size={10} className="text-white -rotate-45" />
                          </button>

                          {showMilestoneNames && (
                            <div 
                              className="absolute top-full left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-500 whitespace-nowrap pointer-events-none transition-all"
                              style={{ marginTop: `${4 + level * 10}px` }}
                            >
                              {milestone.name}
                            </div>
                          )}

                          <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/95 backdrop-blur-sm px-3 py-2 rounded-2xl border border-slate-100 shadow-xl opacity-0 group-hover/milestone:opacity-100 transition-all pointer-events-none z-50 min-w-[150px]">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">
                                {milestone.name}
                              </span>
                              <span className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest">
                                {format(milestone.date, 'EEEE d MMMM yyyy', { locale: fr })}
                              </span>
                              {milestone.description && (
                                <p className="text-[9px] text-slate-500 font-medium mt-1 leading-relaxed whitespace-pre-wrap max-w-[200px]">
                                  {milestone.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Feature Creation Zone (Highlighter) */}
                {isAdmin && (
                  <div 
                    onMouseDown={handleTimelineMouseDown}
                    onMouseEnter={() => setHoverType('feature')}
                    onMouseLeave={() => setHoverType(null)}
                    className="relative h-8 border-b border-slate-100 bg-indigo-50/20 flex items-center justify-center group/creation-zone transition-all hover:bg-indigo-50/40 z-10 cursor-crosshair"
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/creation-zone:opacity-100 pointer-events-none transition-opacity">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-white/80 px-3 py-1 rounded-full shadow-sm border border-indigo-100">
                        Cliquez-glissez pour ajouter une fonctionnalité
                      </span>
                    </div>
                    <div className="absolute inset-0 border-2 border-dashed border-indigo-200/30 m-1 rounded-xl pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Weekends & Public Holidays Background */}
              <div className={cn("absolute inset-0 flex pointer-events-none z-0", focusedSprint ? "top-12" : "top-20")}>
                {Array.from({ length: totalDays }).map((_, i) => {
                  const date = addDays(timelineStart, i);
                  const dayOfWeek = date.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const holiday = holidaysForTimeline.find(h => isSameDay(h.date, date));
                  const isHoliday = !!holiday;
                  
                  if (!isWeekend && !isHoliday) return <div key={i} className="flex-1" />;
                  
                  return (
                    <div 
                      key={i} 
                      className={cn(
                        "flex-1",
                        isHoliday ? "bg-slate-200/60" : "bg-slate-100/40"
                      )} 
                      title={holiday?.name}
                    />
                  );
                })}
              </div>

              {/* Grid Lines */}
              <div className={cn("absolute inset-0 flex pointer-events-none z-0", focusedSprint ? "top-12" : "top-20")}>
                {focusedSprint ? (
                  Array.from({ length: 21 }).map((_, i) => (
                    <div key={i} className="flex-1 border-l border-slate-100 first:border-l-0" />
                  ))
                ) : (
                  timelineMonths.map((month, idx) => {
                    const monthStart = startOfMonth(month);
                    const monthEnd = endOfMonth(month);
                    const daysInMonth = differenceInCalendarDays(monthEnd, monthStart) + 1;
                    const width = (daysInMonth / totalDays) * 100;
                    return (
                      <div 
                        key={idx} 
                        className="border-l border-slate-50 first:border-l-0" 
                        style={{ width: `${width}%` }}
                      />
                    );
                  })
                )}
              </div>

              {/* Sprints Vertical Grid (Subtle) */}
              {showSprints && !focusedSprint && (
                <div className="absolute inset-0 top-20 pointer-events-none flex z-0">
                  {sprints.map((sprint) => {
                    const startPos = getPosition(sprint.start);
                    const endPos = getPosition(addDays(sprint.end, 1));
                    const width = endPos - startPos;
                    
                    return (
                      <div 
                        key={sprint.id}
                        className={cn(
                          "absolute top-0 bottom-0 border-r border-slate-200/30",
                          sprint.number % 2 === 0 ? "bg-slate-50/20" : "bg-transparent"
                        )}
                        style={{ left: `${startPos}%`, width: `${width}%` }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Features Rows */}
              <Reorder.Group 
                axis="y"
                values={features}
                onReorder={reorderFeatures}
                className={cn("space-y-1 relative z-10 select-none min-h-[300px]", isAdmin ? "pt-0" : "pt-2")}
              >
                {/* Selection Overlay */}
                {selectionRange && selectionType === 'feature' && (
                  <div 
                    className="absolute top-0 bottom-0 z-0 pointer-events-none border-x bg-indigo-500/10 border-indigo-500/30"
                    style={{ 
                      left: `${getPosition(selectionRange.start < selectionRange.end ? selectionRange.start : selectionRange.end)}%`, 
                      width: `${Math.abs(getPosition(selectionRange.end) - getPosition(selectionRange.start))}%` 
                    }}
                  />
                )}
                {features.map((feature) => {
                  const startPos = getPosition(feature.startDate);
                  const endPos = getPosition(addDays(feature.endDate, 1));
                  
                  // Only show if it overlaps with the current timeline
                  const isVisible = startPos < 100 && endPos > 0;
                  if (!isVisible) return null;

                  const width = Math.max(endPos - startPos, 0.1);

                  return (
                    <FeatureRow 
                      key={feature.id}
                      feature={feature}
                      startPos={startPos}
                      width={width}
                      isAdmin={isAdmin}
                      resizingFeature={resizingFeature}
                      resizeHandle={resizeHandle}
                      setEditingFeature={setEditingFeature}
                      setIsFeatureModalOpen={setIsFeatureModalOpen}
                      handleResizeStart={handleResizeStart}
                      handleMoveStart={handleMoveStart}
                      setHoverType={setHoverType}
                      setHoveredFeature={setHoveredFeature}
                      showSprints={showSprints}
                      getSprintForDate={getSprintForDate}
                      isSprintView={!!focusedSprint}
                    />
                  );
                })}
              </Reorder.Group>

              {/* Leaves Section */}
              <div className="mt-4 pt-2 border-t border-slate-100 relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Disponibilité Équipe</h3>
                  {focusedSprint && (
                    <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                      Filtré par sprint ({filteredMembers.length})
                    </span>
                  )}
                </div>

                {/* Leave Creation Zone (Highlighter) */}
                {isAdmin && (
                  <div 
                    onMouseDown={(e) => handleTimelineMouseDown(e, 'leave')}
                    onMouseEnter={() => setHoverType('leave')}
                    onMouseLeave={() => setHoverType(null)}
                    className="relative h-8 border-2 border-dashed border-emerald-200/30 bg-emerald-50/10 rounded-xl flex items-center justify-center group/leave-zone transition-all hover:bg-emerald-50/20 z-10 cursor-crosshair mb-2"
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/leave-zone:opacity-100 pointer-events-none transition-opacity">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-white/80 px-3 py-1 rounded-full shadow-sm border border-emerald-100">
                        Cliquez-glissez pour ajouter un congé
                      </span>
                    </div>
                  </div>
                )}

                <div 
                  className="space-y-1 relative min-h-[40px]"
                >
                  {/* Selection Overlay for Leaves */}
                  {selectionRange && selectionType === 'leave' && (
                    <div 
                      className="absolute top-0 bottom-0 bg-emerald-500/10 border-x border-emerald-500/30 z-0 pointer-events-none"
                      style={{ 
                        left: `${getPosition(selectionRange.start < selectionRange.end ? selectionRange.start : selectionRange.end)}%`, 
                        width: `${Math.abs(getPosition(selectionRange.end) - getPosition(selectionRange.start))}%` 
                      }}
                    />
                  )}

                  <div className="relative z-10 space-y-1">
                    {filteredMembers.map(member => (
                      <div 
                        key={member.id} 
                        className="relative h-4 flex items-center group/member cursor-pointer"
                        onMouseDown={(e) => handleTimelineMouseDown(e, 'leave', member.id)}
                      >
                      <div 
                        className="sticky left-0 z-30 flex items-center gap-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-r-xl border-r border-indigo-100 shadow-sm mr-2 min-w-max"
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          setHoverType(null);
                        }}
                      >
                        <button 
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingMember(member);
                            setIsTeamModalOpen(true);
                          }}
                          className="p-1 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all opacity-0 group-hover/member:opacity-100"
                        >
                          <Settings2 size={10} />
                        </button>
                        <span className="text-[10px] font-bold text-slate-600 group-hover/member:text-indigo-600 transition-colors">
                          {member.name}
                        </span>
                      </div>
                      
                      {/* Empty row background to catch clicks */}
                      <div className="absolute inset-0 bg-slate-50/0 group-hover/member:bg-slate-50/50 transition-colors rounded" />
                      
                      {leaves.filter(l => l.memberId === member.id).map(leave => {
                        const startPos = getPosition(leave.startDate);
                        const endPos = getPosition(addDays(leave.endDate, 1));
                        
                        // Only show if it overlaps with the current timeline
                        const isVisible = startPos < 100 && endPos > 0;
                        if (!isVisible) return null;

                        const width = Math.max(endPos - startPos, 0.1);
                        
                        const leaveDays = [];
                        if (focusedSprint) {
                          let curr = startOfDay(leave.startDate);
                          const end = startOfDay(leave.endDate);
                          while (curr <= end) {
                            leaveDays.push(new Date(curr));
                            curr = addDays(curr, 1);
                          }
                        }

                        return (
                          <div 
                            key={leave.id}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isAdmin) return;
                              setEditingLeave(leave);
                              setIsLeaveModalOpen(true);
                            }}
                            onMouseEnter={() => {
                              setHoverType('leave');
                              setHoveredLeave(leave);
                              setHoverDate(leave.startDate);
                            }}
                            onMouseLeave={() => {
                              setHoverType(null);
                              setHoveredLeave(null);
                              setHoverDate(null);
                            }}
                            className={cn(
                              "absolute h-3 rounded-md shadow-sm border border-white/20 bg-hatched cursor-pointer hover:brightness-110 transition-all overflow-hidden",
                              "bg-emerald-500"
                            )}
                            style={{ 
                              left: `${startPos}%`, 
                              width: `${width}%`
                            }}
                          >
                            {/* Weekend and Holiday Overlays for Leaves */}
                            {focusedSprint && (
                              <div className="absolute inset-0 flex pointer-events-none">
                                {leaveDays.map((day, i) => {
                                  const weekend = isWeekend(day);
                                  const holiday = isHoliday(day);
                                  return (
                                    <div 
                                      key={i} 
                                      className={cn(
                                        "h-full flex-1",
                                        weekend ? "bg-white/30" : holiday ? "bg-amber-200/40" : ""
                                      )} 
                                    />
                                  );
                                })}
                              </div>
                            )}
                            <div 
                              className="absolute inset-y-0 flex items-center px-2 min-w-0"
                              style={{
                                left: startPos < 0 ? `${(Math.abs(startPos) / width) * 100}%` : '0',
                                width: startPos < 0 ? `${Math.max(0, (1 - Math.abs(startPos) / width) * 100)}%` : '100%'
                              }}
                            >
                              {width > 5 && (
                                <span className="text-[8px] font-black text-white truncate uppercase drop-shadow-sm">
                                  {leave.label}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

              {/* Today Line */}
              {isWithinInterval(new Date(), { 
                start: timelineStart, 
                end: addDays(timelineEnd, 1) 
              }) && (
                <div 
                  className="absolute top-0 bottom-0 w-px bg-indigo-500 z-20 pointer-events-none"
                  style={{ left: `${getPosition(new Date(), true)}%` }}
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-indigo-500 shadow-sm" />
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter">
                    Aujourd'hui
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Info */}
          <div className="bg-slate-50 border-t border-slate-100 p-4 px-8 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Macro Vision</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{features.length} Features</span>
              </div>
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Généré par MacroGantt • {format(new Date(), 'yyyy')}
            </div>
          </div>
        </div>
      </main>

      {/* Feature Management Modal */}
      <Dialog.Root 
        open={isFeatureModalOpen} 
        onOpenChange={(open) => {
          setIsFeatureModalOpen(open);
          if (!open && editingFeature?.isNew) {
            setEditingFeature(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 animate-in fade-in duration-300" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-3xl shadow-2xl z-50 p-8 animate-in zoom-in-95 fade-in duration-300 outline-none">
            <div className="flex items-center justify-between mb-8">
              <div>
                <Dialog.Title className="text-2xl font-black text-slate-900">Gestion des Features</Dialog.Title>
                <Dialog.Description className="text-slate-500 font-medium">Ajoutez ou modifiez vos fonctionnalités clés</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400">
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>

              <div className="flex gap-8">
                {isAdmin && (
                  <div className="w-1/3 border-r border-slate-100 pr-6 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                    <button 
                      onClick={() => addFeature()}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all mb-4"
                    >
                      <Plus size={14} />
                      Nouvelle Feature
                    </button>
                    <Reorder.Group axis="y" values={features} onReorder={reorderFeatures} className="space-y-2">
                      {[...(editingFeature?.isNew ? [editingFeature] : []), ...features].map(f => (
                        <ReorderItemWithHandle 
                          key={f.id} 
                          feature={f} 
                          isActive={editingFeature?.id === f.id}
                          onClick={() => setEditingFeature(f)}
                        />
                      ))}
                    </Reorder.Group>
                  </div>
                )}

                <div className="flex-1">
                {editingFeature ? (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom de la fonctionnalité</label>
                      <input 
                        type="text"
                        value={editingFeature.name}
                        onChange={(e) => updateFeature(editingFeature.id, { name: e.target.value }, false)}
                        className="w-full text-lg font-bold bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        placeholder="Ex: Refonte Dashboard"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                      <textarea 
                        value={editingFeature.description || ''}
                        onChange={(e) => updateFeature(editingFeature.id, { description: e.target.value }, false)}
                        className="w-full text-sm font-medium bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[100px] resize-none"
                        placeholder="Détails de la fonctionnalité..."
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => updateFeature(editingFeature.id, { startSprint: null, endSprint: null }, false)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                            !editingFeature.startSprint 
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" 
                              : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                          )}
                        >
                          Dates Précises
                        </button>
                        <button 
                          onClick={() => {
                            const startNum = 1;
                            const endNum = 2;
                            const { start, end } = getSprintDates(startNum);
                            updateFeature(editingFeature.id, { 
                              startSprint: startNum, 
                              endSprint: endNum,
                              startDate: start,
                              endDate: end
                            }, false);
                          }}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                            editingFeature.startSprint 
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" 
                              : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                          )}
                        >
                          Sprints
                        </button>
                      </div>

                      {!editingFeature.startSprint ? (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date de début</label>
                            <input 
                              type="date"
                              value={format(editingFeature.startDate, 'yyyy-MM-dd')}
                              onChange={(e) => updateFeature(editingFeature.id, { startDate: parseISO(e.target.value) }, false)}
                              className="w-full text-sm font-bold bg-slate-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date de fin</label>
                            <input 
                              type="date"
                              value={format(editingFeature.endDate, 'yyyy-MM-dd')}
                              onChange={(e) => updateFeature(editingFeature.id, { endDate: parseISO(e.target.value) }, false)}
                              className="w-full text-sm font-bold bg-slate-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sprint de début</label>
                            <select 
                              value={editingFeature.startSprint}
                              onChange={(e) => {
                                const startNum = parseInt(e.target.value);
                                const endNum = Math.max(startNum, editingFeature.endSprint || startNum);
                                const { start } = getSprintDates(startNum);
                                const { end } = getSprintDates(endNum);
                                updateFeature(editingFeature.id, { 
                                  startSprint: startNum, 
                                  endSprint: endNum,
                                  startDate: start,
                                  endDate: end
                                }, false);
                              }}
                              className="w-full text-sm font-bold bg-slate-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer"
                            >
                              {sprintOptions.map(n => (
                                <option key={n} value={n}>Sprint {n}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sprint de fin</label>
                            <select 
                              value={editingFeature.endSprint}
                              onChange={(e) => {
                                const endNum = parseInt(e.target.value);
                                const startNum = Math.min(endNum, editingFeature.startSprint || endNum);
                                const { start } = getSprintDates(startNum);
                                const { end } = getSprintDates(endNum);
                                updateFeature(editingFeature.id, { 
                                  startSprint: startNum, 
                                  endSprint: endNum,
                                  startDate: start,
                                  endDate: end
                                }, false);
                              }}
                              className="w-full text-sm font-bold bg-slate-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none cursor-pointer"
                            >
                              {sprintOptions.map(n => (
                                <option key={n} value={n}>Sprint {n}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Priorité</label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map(p => (
                          <button 
                            key={p}
                            type="button"
                            onClick={() => updateFeature(editingFeature.id, { priority: p }, false)}
                            className={cn(
                              "w-10 h-10 rounded-xl font-black text-sm transition-all flex items-center justify-center",
                              editingFeature.priority === p 
                                ? cn("text-white shadow-lg", PRIORITY_COLORS[p]) 
                                : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                            )}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Couleur</label>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400">Pipette</span>
                          <div className="relative w-8 h-8">
                            <input 
                              type="color" 
                              value={editingFeature.color.startsWith('bg-') ? COLORS.find(c => c.bg === editingFeature.color)?.hex || '#6366f1' : editingFeature.color}
                              onChange={(e) => updateFeature(editingFeature.id, { color: e.target.value }, false)}
                              className="absolute inset-0 w-full h-full cursor-pointer border-none p-0 opacity-0"
                            />
                            <div 
                              className="w-full h-full rounded-xl border border-slate-200 shadow-sm" 
                              style={{ backgroundColor: editingFeature.color.startsWith('bg-') ? COLORS.find(c => c.bg === editingFeature.color)?.hex || '#6366f1' : editingFeature.color }}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Standards</span>
                        <div className="flex flex-wrap gap-2">
                          {COLORS.map(c => (
                            <button 
                              key={c.bg}
                              type="button"
                              onClick={() => updateFeature(editingFeature.id, { color: c.bg }, false)}
                              className={cn(
                                "w-7 h-7 rounded-lg transition-all ring-offset-2",
                                c.bg,
                                editingFeature.color === c.bg ? "ring-2 ring-indigo-500 scale-110" : "hover:scale-110 opacity-60 hover:opacity-100"
                              )}
                            />
                          ))}
                        </div>
                      </div>

                      {usedColors.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Déjà utilisées</span>
                          <div className="flex flex-wrap gap-2">
                            {usedColors.map((color, idx) => (
                              <button 
                                key={idx}
                                type="button"
                                onClick={() => updateFeature(editingFeature.id, { color }, false)}
                                className={cn(
                                  "w-7 h-7 rounded-lg transition-all ring-offset-2",
                                  color.startsWith('bg-') ? color : "",
                                  editingFeature.color === color ? "ring-2 ring-indigo-500 scale-110" : "hover:scale-110 opacity-60 hover:opacity-100"
                                )}
                                style={!color.startsWith('bg-') ? { backgroundColor: color } : {}}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="pt-6 flex items-center justify-between border-t border-slate-100">
                        <button 
                          onClick={() => removeFeature(editingFeature.id)}
                          className="flex items-center gap-2 px-4 py-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all font-bold text-xs"
                        >
                          <Trash2 size={14} />
                          Supprimer
                        </button>
                        <button 
                          onClick={async () => {
                            if (!editingFeature || !currentRoadmapId) return;
                            
                            try {
                              if (editingFeature.isNew) {
                                const { isNew, id: tempId, ...data } = editingFeature;
                                const id = Math.random().toString(36).substr(2, 9);
                                await setDoc(doc(db, 'roadmaps', currentRoadmapId, 'features', id), {
                                  ...data,
                                  description: data.description || '',
                                  priority: data.priority || 3,
                                  startSprint: data.startSprint ?? null,
                                  endSprint: data.endSprint ?? null,
                                  startDate: Timestamp.fromDate(data.startDate),
                                  endDate: Timestamp.fromDate(data.endDate)
                                });
                                toast.success("Fonctionnalité ajoutée");
                              } else {
                                await updateFeature(editingFeature.id, editingFeature, true);
                              }
                              setIsFeatureModalOpen(false);
                            } catch (error) {
                              console.error("Validation error:", error);
                              // Error is already handled/toasted in updateFeature or we should toast here for setDoc
                              if (editingFeature.isNew) {
                                toast.error("Erreur lors de l'ajout de la fonctionnalité");
                              }
                            }
                          }}
                          className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                        >
                          <Check size={16} />
                          Valider les modifications
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                    <Layers size={48} strokeWidth={1} />
                    <p className="text-sm font-medium">Sélectionnez une feature pour la modifier</p>
                  </div>
                )}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Milestone Management Modal */}
      <Dialog.Root open={isMilestoneModalOpen} onOpenChange={setIsMilestoneModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 animate-in fade-in duration-300" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-3xl shadow-2xl z-50 p-8 animate-in zoom-in-95 fade-in duration-300 outline-none">
            <div className="flex items-center justify-between mb-8">
              <div>
                <Dialog.Title className="text-2xl font-black text-slate-900">Gestion des Jalons</Dialog.Title>
                <Dialog.Description className="text-slate-500 font-medium">Définissez les moments clés de votre projet</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400">
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>

            <div className="flex gap-8">
              {isAdmin && (
                <div className="w-1/3 border-r border-slate-100 pr-6 space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                  <button 
                    onClick={() => addMilestone()}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all mb-4"
                  >
                    <Plus size={14} />
                    Nouveau Jalon
                  </button>
                  {milestones.map(m => (
                    <button 
                      key={m.id}
                      onClick={() => setEditingMilestone(m)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-3",
                        editingMilestone?.id === m.id ? "bg-indigo-50 text-indigo-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      <div 
                        className={cn("w-2 h-2 rounded-full shrink-0", m.color.startsWith('bg-') ? m.color : "")} 
                        style={!m.color.startsWith('bg-') ? { backgroundColor: m.color } : {}}
                      />
                      <span className="truncate">{m.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1">
                {editingMilestone ? (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom du jalon</label>
                      <input 
                        type="text"
                        value={editingMilestone.name}
                        onChange={(e) => updateMilestone(editingMilestone.id, { name: e.target.value }, false)}
                        className="w-full text-lg font-bold bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        placeholder="Ex: Mise en production"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                      <textarea 
                        value={editingMilestone.description || ''}
                        onChange={(e) => updateMilestone(editingMilestone.id, { description: e.target.value }, false)}
                        className="w-full text-sm font-medium bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/20 outline-none min-h-[100px] resize-none"
                        placeholder="Ajoutez une description détaillée..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</label>
                      <input 
                        type="date"
                        value={format(editingMilestone.date, 'yyyy-MM-dd')}
                        onChange={(e) => updateMilestone(editingMilestone.id, { date: parseISO(e.target.value) }, false)}
                        className="w-full text-sm font-bold bg-slate-50 border-none rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Couleur</label>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400">Pipette</span>
                          <div className="relative w-8 h-8">
                            <input 
                              type="color" 
                              value={editingMilestone.color.startsWith('bg-') ? COLORS.find(c => c.bg === editingMilestone.color)?.hex || '#6366f1' : editingMilestone.color}
                              onChange={(e) => updateMilestone(editingMilestone.id, { color: e.target.value }, false)}
                              className="absolute inset-0 w-full h-full cursor-pointer border-none p-0 opacity-0"
                            />
                            <div 
                              className="w-full h-full rounded-xl border border-slate-200 shadow-sm" 
                              style={{ backgroundColor: editingMilestone.color.startsWith('bg-') ? COLORS.find(c => c.bg === editingMilestone.color)?.hex || '#6366f1' : editingMilestone.color }}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Standards</span>
                        <div className="flex flex-wrap gap-2">
                          {COLORS.map(c => (
                            <button 
                              key={c.bg}
                              type="button"
                              onClick={() => updateMilestone(editingMilestone.id, { color: c.bg }, false)}
                              className={cn(
                                "w-7 h-7 rounded-lg transition-all ring-offset-2",
                                c.bg,
                                editingMilestone.color === c.bg ? "ring-2 ring-indigo-500 scale-110" : "hover:scale-110 opacity-60 hover:opacity-100"
                              )}
                            />
                          ))}
                        </div>
                      </div>

                      {usedColors.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Déjà utilisées</span>
                          <div className="flex flex-wrap gap-2">
                            {usedColors.map((color, idx) => (
                              <button 
                                key={idx}
                                type="button"
                                onClick={() => updateMilestone(editingMilestone.id, { color }, false)}
                                className={cn(
                                  "w-7 h-7 rounded-lg transition-all ring-offset-2",
                                  color.startsWith('bg-') ? color : "",
                                  editingMilestone.color === color ? "ring-2 ring-indigo-500 scale-110" : "hover:scale-110 opacity-60 hover:opacity-100"
                                )}
                                style={!color.startsWith('bg-') ? { backgroundColor: color } : {}}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-6 flex items-center justify-between border-t border-slate-100">
                      <button 
                        onClick={() => {
                          if (!editingMilestone.id.startsWith('new_')) {
                            removeMilestone(editingMilestone.id);
                          }
                          setIsMilestoneModalOpen(false);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all font-bold text-xs"
                      >
                        <Trash2 size={14} />
                        {editingMilestone.id.startsWith('new_') ? 'Annuler' : 'Supprimer'}
                      </button>
                      <button 
                        onClick={async () => {
                          await updateMilestone(editingMilestone.id, editingMilestone, true);
                          setIsMilestoneModalOpen(false);
                        }}
                        className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                      >
                        <Check size={16} />
                        {editingMilestone.id.startsWith('new_') ? 'Ajouter le jalon' : 'Valider les modifications'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                    <Flag size={48} strokeWidth={1} />
                    <p className="text-sm font-medium">Sélectionnez un jalon pour le modifier</p>
                  </div>
                )}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Team Management Modal */}
      <Dialog.Root open={isTeamModalOpen} onOpenChange={setIsTeamModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 animate-in fade-in duration-300" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-white rounded-3xl shadow-2xl z-50 p-8 animate-in zoom-in-95 fade-in duration-300 outline-none">
            <div className="flex items-center justify-between mb-8">
              <div>
                <Dialog.Title className="text-2xl font-black text-slate-900">Équipe & Disponibilités</Dialog.Title>
                <Dialog.Description className="text-slate-500 font-medium">Gérez vos membres et leurs périodes d'absence</Dialog.Description>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => addLeave()}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-100 transition-all"
                >
                  <Plus size={14} />
                  Ajouter un congé
                </button>
                <Dialog.Close asChild>
                  <button className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400">
                    <X size={20} />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            <div className="flex gap-8">
              <div className="w-1/4 border-r border-slate-100 pr-6 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                {isAdmin && (
                  <button 
                    onClick={() => addTeamMember()}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all mb-4"
                  >
                    <Plus size={14} />
                    Nouveau Membre
                  </button>
                )}
                {teamMembers.map(m => (
                  <button 
                    key={m.id}
                    onClick={() => setEditingMember(m)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-3",
                      editingMember?.id === m.id ? "bg-indigo-50 text-indigo-600 shadow-sm" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <div 
                      className={cn("w-2 h-2 rounded-full shrink-0", m.color.startsWith('bg-') ? m.color : "")} 
                      style={!m.color.startsWith('bg-') ? { backgroundColor: m.color } : {}}
                    />
                    <span className="truncate">{m.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1">
                {editingMember ? (
                  <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex items-end gap-6">
                      <div className="flex-1 space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom du membre</label>
                        <input 
                          type="text"
                          value={editingMember.name}
                          disabled={!isAdmin}
                          onChange={(e) => updateTeamMember(editingMember.id, { name: e.target.value }, false)}
                          className={cn(
                            "w-full text-lg font-bold bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/20 outline-none",
                            !isAdmin && "cursor-not-allowed opacity-70"
                          )}
                        />
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Couleur</label>
                          {isAdmin && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400">Pipette</span>
                              <div className="relative w-8 h-8">
                                <input 
                                  type="color" 
                                  value={editingMember.color.startsWith('bg-') ? COLORS.find(c => c.bg === editingMember.color)?.hex || '#6366f1' : editingMember.color}
                                  onChange={(e) => updateTeamMember(editingMember.id, { color: e.target.value }, false)}
                                  className="absolute inset-0 w-full h-full cursor-pointer border-none p-0 opacity-0"
                                />
                                <div 
                                  className="w-full h-full rounded-xl border border-slate-200 shadow-sm" 
                                  style={{ backgroundColor: editingMember.color.startsWith('bg-') ? COLORS.find(c => c.bg === editingMember.color)?.hex || '#6366f1' : editingMember.color }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {isAdmin && (
                          <div className="space-y-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Standards</span>
                            <div className="flex flex-wrap gap-2">
                              {COLORS.map(c => (
                                <button 
                                  key={c.bg}
                                  type="button"
                                  onClick={() => updateTeamMember(editingMember.id, { color: c.bg }, false)}
                                  className={cn(
                                    "w-6 h-6 rounded-lg transition-all",
                                    c.bg,
                                    editingMember.color === c.bg ? "ring-2 ring-indigo-500 ring-offset-2 scale-110" : "opacity-40 hover:opacity-100"
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {isAdmin && usedColors.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Déjà utilisées</span>
                            <div className="flex flex-wrap gap-2">
                              {usedColors.map((color, idx) => (
                                <button 
                                  key={idx}
                                  type="button"
                                  onClick={() => updateTeamMember(editingMember.id, { color }, false)}
                                  className={cn(
                                    "w-6 h-6 rounded-lg transition-all",
                                    color.startsWith('bg-') ? color : "",
                                    editingMember.color === color ? "ring-2 ring-indigo-500 ring-offset-2 scale-110" : "opacity-40 hover:opacity-100"
                                  )}
                                  style={!color.startsWith('bg-') ? { backgroundColor: color } : {}}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        {!isAdmin && (
                          <div 
                            className="w-8 h-8 rounded-xl border border-slate-200 shadow-sm" 
                            style={{ backgroundColor: editingMember.color.startsWith('bg-') ? COLORS.find(c => c.bg === editingMember.color)?.hex || '#6366f1' : editingMember.color }}
                          />
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Périodes de Congés</h4>
                        {isAdmin && (
                          <button 
                            onClick={() => addLeave(editingMember.id)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-[10px] hover:bg-indigo-100 transition-all"
                          >
                            <Plus size={12} />
                            Ajouter un congé
                          </button>
                        )}
                      </div>

                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {leaves.filter(l => l.memberId === editingMember.id).map(leave => (
                          <div 
                            key={leave.id} 
                            className={cn(
                              "bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center justify-between group transition-all",
                              isAdmin ? "hover:border-indigo-200 cursor-pointer" : "cursor-default"
                            )}
                            onClick={() => {
                              if (isAdmin) {
                                setEditingLeave(leave);
                                setIsLeaveModalOpen(true);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div 
                                className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-white shadow-sm", editingMember.color.startsWith('bg-') ? editingMember.color : "")}
                                style={!editingMember.color.startsWith('bg-') ? { backgroundColor: editingMember.color } : {}}
                              >
                                <CalendarIcon className="text-white" size={14} />
                              </div>
                              <div className="flex-1">
                                <p className="text-[11px] font-bold text-slate-900">{leave.label}</p>
                                <p className="text-[9px] font-medium text-slate-500">
                                  {format(leave.startDate, 'dd MMM')} - {format(leave.endDate, 'dd MMM yyyy')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isAdmin && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeLeave(leave.id);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                  title="Supprimer"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                              {isAdmin && <ChevronRight size={14} className="text-slate-300" />}
                            </div>
                          </div>
                        ))}
                        {leaves.filter(l => l.memberId === editingMember.id).length === 0 && (
                          <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-[10px] font-medium text-slate-400">Aucun congé enregistré</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-6 flex items-center justify-between border-t border-slate-100">
                      {isAdmin ? (
                        <>
                          <button 
                            onClick={() => {
                              if (confirm('Êtes-vous sûr de vouloir supprimer ce membre et tous ses congés ?')) {
                                removeTeamMember(editingMember.id);
                                setIsTeamModalOpen(false);
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all font-bold text-xs"
                          >
                            <Trash2 size={14} />
                            Supprimer
                          </button>
                          <button 
                            onClick={async () => {
                              await updateTeamMember(editingMember.id, editingMember, true);
                              setIsTeamModalOpen(false);
                            }}
                            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                          >
                            <Check size={16} />
                            Valider les modifications
                          </button>
                        </>
                      ) : (
                        <div className="w-full flex justify-end">
                          <button 
                            onClick={() => setIsTeamModalOpen(false)}
                            className="px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all"
                          >
                            Fermer
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                    <Users size={48} strokeWidth={1} />
                    <p className="text-sm font-medium">Sélectionnez un membre pour gérer ses congés</p>
                  </div>
                )}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Leave Management Modal */}
      <Dialog.Root open={isLeaveModalOpen} onOpenChange={setIsLeaveModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] animate-in fade-in duration-300" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-[32px] shadow-2xl z-[111] overflow-hidden animate-in zoom-in-95 duration-300">
            {editingLeave && (
              <div className="flex flex-col">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div 
                      className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg", (teamMembers.find(m => m.id === editingLeave.memberId)?.color || 'bg-slate-400').startsWith('bg-') ? (teamMembers.find(m => m.id === editingLeave.memberId)?.color || 'bg-slate-400') : "")}
                      style={!(teamMembers.find(m => m.id === editingLeave.memberId)?.color || 'bg-slate-400').startsWith('bg-') ? { backgroundColor: teamMembers.find(m => m.id === editingLeave.memberId)?.color } : {}}
                    >
                      <CalendarIcon className="text-white" size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Détails du congé</h2>
                      <p className="text-slate-500 text-sm font-medium">
                        {teamMembers.find(m => m.id === editingLeave.memberId)?.name}
                      </p>
                    </div>
                  </div>
                  <Dialog.Close className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm group">
                    <X className="text-slate-400 group-hover:text-slate-600 transition-colors" size={20} />
                  </Dialog.Close>
                </div>

                <div className="p-8 space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Membre de l'équipe</label>
                      {isAdmin && !isAddingMemberInLeaveModal && (
                        <button 
                          onClick={() => setIsAddingMemberInLeaveModal(true)}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                        >
                          <Plus size={10} />
                          Nouveau membre
                        </button>
                      )}
                    </div>
                    
                    {isAddingMemberInLeaveModal && isAdmin ? (
                      <div className="flex gap-2">
                        <input 
                          autoFocus
                          type="text"
                          placeholder="Nom du membre..."
                          value={newMemberName}
                          onChange={(e) => setNewMemberName(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && newMemberName.trim()) {
                              const member = await createTeamMember(newMemberName);
                              if (member) {
                                setEditingLeave(prev => prev ? { ...prev, memberId: member.id } : null);
                                setIsAddingMemberInLeaveModal(false);
                                setNewMemberName('');
                                toast.success(`Membre ${member.name} ajouté`);
                              }
                            } else if (e.key === 'Escape') {
                              setIsAddingMemberInLeaveModal(false);
                              setNewMemberName('');
                            }
                          }}
                          className="flex-1 text-sm font-bold bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        />
                        <button 
                          onClick={() => {
                            setIsAddingMemberInLeaveModal(false);
                            setNewMemberName('');
                          }}
                          className="p-4 text-slate-400 hover:text-slate-600"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <select 
                          value={editingLeave.memberId}
                          disabled={!isAdmin}
                          onChange={(e) => {
                            const newMemberId = e.target.value;
                            setEditingLeave(prev => prev ? { ...prev, memberId: newMemberId } : null);
                          }}
                          className={cn(
                            "w-full text-sm font-bold bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none pr-10",
                            isAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                          )}
                        >
                          {teamMembers.length === 0 && <option value="">Aucun membre</option>}
                          {teamMembers.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                        {isAdmin && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <ChevronDown size={16} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Libellé</label>
                    <input 
                      type="text"
                      value={editingLeave.label}
                      disabled={!isAdmin}
                      onChange={(e) => setEditingLeave(prev => prev ? { ...prev, label: e.target.value } : null)}
                      className={cn(
                        "w-full text-lg font-bold bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/20 outline-none",
                        !isAdmin && "cursor-not-allowed opacity-70"
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date de début</label>
                      <input 
                        type="date"
                        value={format(editingLeave.startDate, 'yyyy-MM-dd')}
                        disabled={!isAdmin}
                        onChange={(e) => setEditingLeave(prev => prev ? { ...prev, startDate: parseISO(e.target.value) } : null)}
                        className={cn(
                          "w-full font-bold bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/20 outline-none",
                          !isAdmin && "cursor-not-allowed opacity-70"
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date de fin</label>
                      <input 
                        type="date"
                        value={format(editingLeave.endDate, 'yyyy-MM-dd')}
                        disabled={!isAdmin}
                        onChange={(e) => setEditingLeave(prev => prev ? { ...prev, endDate: parseISO(e.target.value) } : null)}
                        className={cn(
                          "w-full font-bold bg-slate-50 border-none rounded-2xl p-4 focus:ring-2 focus:ring-indigo-500/20 outline-none",
                          !isAdmin && "cursor-not-allowed opacity-70"
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-8 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                  {isAdmin ? (
                    <>
                      <button 
                        onClick={() => {
                          if (!editingLeave.id.startsWith('new_')) {
                            removeLeave(editingLeave.id);
                          }
                          setIsLeaveModalOpen(false);
                        }}
                        className="flex items-center gap-2 px-6 py-3 text-rose-500 hover:bg-rose-50 rounded-2xl font-bold text-sm transition-all"
                      >
                        <Trash2 size={18} />
                        {editingLeave.id.startsWith('new_') ? 'Annuler' : 'Supprimer'}
                      </button>
                      <button 
                        onClick={async () => {
                          if (!editingLeave.memberId) {
                            toast.error("Veuillez sélectionner un membre");
                            return;
                          }
                          await updateLeave(editingLeave.id, editingLeave, true);
                          setIsLeaveModalOpen(false);
                        }}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                      >
                        <Check size={18} className="inline-block mr-2" />
                        {editingLeave.id.startsWith('new_') ? 'Ajouter le congé' : 'Valider les modifications'}
                      </button>
                    </>
                  ) : (
                    <div className="w-full flex justify-end">
                      <button 
                        onClick={() => setIsLeaveModalOpen(false)}
                        className="px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all"
                      >
                        Fermer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Roadmap Modal */}
      <Dialog.Root open={isRoadmapModalOpen} onOpenChange={setIsRoadmapModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] animate-in fade-in duration-300" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 z-[101] animate-in zoom-in-95 fade-in duration-300">
            <div className="flex items-center justify-between mb-6">
              <Dialog.Title className="text-xl font-black text-slate-900 tracking-tight">Paramètres Roadmap</Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>

            {editingRoadmap && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom de la roadmap</label>
                  <input 
                    type="text"
                    value={editingRoadmap.name}
                    onChange={(e) => setEditingRoadmap({ ...editingRoadmap, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    placeholder="Ex: Roadmap Produit 2026"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                  <textarea 
                    value={editingRoadmap.description || ''}
                    onChange={(e) => setEditingRoadmap({ ...editingRoadmap, description: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all min-h-[100px]"
                    placeholder="Vision macroscopique..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date de début</label>
                    <input 
                      type="date"
                      value={format(editingRoadmap.viewStartDate || viewStartDate, 'yyyy-MM-dd')}
                      onChange={(e) => setEditingRoadmap({ ...editingRoadmap, viewStartDate: new Date(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date de fin</label>
                    <input 
                      type="date"
                      value={format(editingRoadmap.viewEndDate || viewEndDate, 'yyyy-MM-dd')}
                      onChange={(e) => setEditingRoadmap({ ...editingRoadmap, viewEndDate: new Date(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Début Sprints</label>
                    <input 
                      type="date"
                      value={format(editingRoadmap.sprintStartDate, 'yyyy-MM-dd')}
                      onChange={(e) => setEditingRoadmap({ ...editingRoadmap, sprintStartDate: new Date(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">Afficher les sprints</span>
                    <span className="text-[10px] text-slate-500">Affiche la grille des sprints sur le Gantt</span>
                  </div>
                  <Switch.Root 
                    checked={editingRoadmap.showSprints ?? true} 
                    onCheckedChange={(checked) => setEditingRoadmap({ ...editingRoadmap, showSprints: checked })}
                    className="w-8 h-4 bg-slate-200 rounded-full relative data-[state=checked]:bg-indigo-600 transition-colors outline-none cursor-pointer"
                  >
                    <Switch.Thumb className="block w-3 h-3 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[18px]" />
                  </Switch.Root>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">Afficher les noms des jalons</span>
                    <span className="text-[10px] text-slate-500">Affiche le texte sous les drapeaux</span>
                  </div>
                  <Switch.Root 
                    checked={editingRoadmap.showMilestoneNames ?? true} 
                    onCheckedChange={(checked) => setEditingRoadmap({ ...editingRoadmap, showMilestoneNames: checked })}
                    className="w-8 h-4 bg-slate-200 rounded-full relative data-[state=checked]:bg-indigo-600 transition-colors outline-none cursor-pointer"
                  >
                    <Switch.Thumb className="block w-3 h-3 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[18px]" />
                  </Switch.Root>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900">Visible par tous</span>
                    <span className="text-[10px] text-slate-500">Masquer pour les non-administrateurs</span>
                  </div>
                  <Switch.Root 
                    checked={editingRoadmap.isVisibleToAll ?? true} 
                    onCheckedChange={(checked) => setEditingRoadmap({ ...editingRoadmap, isVisibleToAll: checked })}
                    className="w-8 h-4 bg-slate-200 rounded-full relative data-[state=checked]:bg-indigo-600 transition-colors outline-none cursor-pointer"
                  >
                    <Switch.Thumb className="block w-3 h-3 bg-white rounded-full transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[18px]" />
                  </Switch.Root>
                </div>

                <div className="pt-4 flex items-center justify-between gap-3">
                  <button 
                    onClick={() => {
                      if (confirm("Supprimer cette roadmap ?")) {
                        removeRoadmap(editingRoadmap.id);
                        setIsRoadmapModalOpen(false);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all font-bold text-xs"
                  >
                    <Trash2 size={14} />
                    Supprimer
                  </button>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsRoadmapModalOpen(false)}
                      className="px-6 py-2 text-slate-500 font-bold text-xs hover:bg-slate-100 rounded-xl transition-all"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'roadmaps', editingRoadmap.id), {
                            name: editingRoadmap.name,
                            description: editingRoadmap.description || '',
                            viewStartDate: Timestamp.fromDate(editingRoadmap.viewStartDate || viewStartDate),
                            viewEndDate: Timestamp.fromDate(editingRoadmap.viewEndDate || viewEndDate),
                            showSprints: editingRoadmap.showSprints ?? true,
                            showMilestoneNames: editingRoadmap.showMilestoneNames ?? true,
                            isVisibleToAll: editingRoadmap.isVisibleToAll ?? true,
                            sprintStartDate: Timestamp.fromDate(editingRoadmap.sprintStartDate)
                          });
                          toast.success("Roadmap mise à jour avec succès");
                          setIsRoadmapModalOpen(false);
                        } catch (error) {
                          toast.error("Erreur lors de la mise à jour de la roadmap");
                        }
                      }}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold text-xs shadow-lg shadow-indigo-200"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Selection/Hover Tooltip */}
      {(isSelecting && selectionRange) || resizingFeature || (hoverType && hoverDate) ? (
        <div 
          className="fixed pointer-events-none z-[100] bg-slate-900/90 text-white px-3 py-2 rounded-xl text-[10px] font-bold shadow-2xl flex flex-col gap-1 border border-white/10 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
          style={{ 
            left: mousePos.x + 20, 
            top: mousePos.y - 40 
          }}
        >
          <div className={cn(
            "flex items-center gap-2",
            (selectionType || hoverType || (resizingFeature ? 'feature' : null)) === 'leave' ? "text-emerald-400" : 
            (selectionType || hoverType) === 'milestone' ? "text-rose-400" : 
            "text-indigo-400"
          )}>
            <CalendarIcon size={12} />
            <span className="uppercase tracking-widest">
              {(selectionType || hoverType) === 'milestone' ? 'Jalon' : (selectionType || hoverType || (resizingFeature ? 'feature' : null)) === 'leave' ? 'Congés' : 'Fonctionnalité'}
            </span>
          </div>
          <div className="flex flex-col">
            {(hoveredFeature || resizingFeature || hoveredLeave) && (
              <span className="text-white text-[11px] font-black mb-1 border-b border-white/10 pb-1">
                {hoveredLeave 
                  ? teamMembers.find(m => m.id === hoveredLeave.memberId)?.name 
                  : (hoveredFeature?.name || resizingFeature?.name)}
              </span>
            )}
            {(hoveredFeature?.description || resizingFeature?.description || (hoveredLeave && hoveredLeave.label && !['Congé', 'Congés', 'Vacances'].includes(hoveredLeave.label))) && (
              <span className="text-slate-300 text-[9px] mb-2 leading-tight max-w-[200px] break-words whitespace-pre-wrap">
                {hoveredFeature?.description || resizingFeature?.description || hoveredLeave?.label}
              </span>
            )}
            {(isSelecting && selectionRange) || resizingFeature || hoveredFeature || hoveredLeave ? (
              <div className="flex items-center gap-1 text-[10px] text-slate-300">
                <span>
                  {format(
                    isSelecting && selectionRange 
                      ? (selectionRange.start < selectionRange.end ? selectionRange.start : selectionRange.end)
                      : (resizingFeature || hoveredFeature || hoveredLeave)!.startDate, 
                    'd MMMM', { locale: fr }
                  )}
                </span>
                {((isSelecting && selectionType !== 'milestone') || resizingFeature || hoveredFeature || hoveredLeave) && (
                  <>
                    <span className="opacity-60">au</span>
                    <span>
                      {format(
                        isSelecting && selectionRange
                          ? (selectionRange.start < selectionRange.end ? selectionRange.end : selectionRange.start)
                          : (resizingFeature || hoveredFeature || hoveredLeave)!.endDate,
                        'd MMMM yyyy', { locale: fr }
                      )}
                    </span>
                  </>
                )}
              </div>
            ) : hoverDate ? (
              <span className="text-white">
                {format(hoverDate, 'd MMMM yyyy', { locale: fr })}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
      </div>
    </Tooltip.Provider>
  );
}
