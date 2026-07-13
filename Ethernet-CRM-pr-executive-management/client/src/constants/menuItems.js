import { 
  LayoutDashboard, 
  Package, 
  Warehouse, 
  ShoppingCart, 
  FileText, 
  ArrowRightLeft, 
  TrendingDown, 
  Undo2, 
  BarChart3, 
  History,
  Briefcase,
  ClipboardList,
  ClipboardCheck,
  // CheckSquare,
  Layers,
  Truck,
  Building2,
  FileCheck,
  Eye,
  Hammer,
  Receipt,
  FolderOpen,
  Users,
  Shield,
} from "lucide-react";

export const MENU_CATEGORIES = [
  {
    category: "Main",
    items: [
      {
        title: "Dashboard",
        path: "/",
        icon: LayoutDashboard,
      },
      {
        title: "Attendance",
        path: "/attendance",
        icon: ClipboardCheck,
        hidden: false,
      },
    ]
  },
  {
    category: "Project Management",
    items: [
      {
        title: "Projects",
        path: "/projects",
        icon: Briefcase,
      },
      {
        title: "BOQ Management",
        path: "/boq",
        icon: ClipboardList,
      },
      // {
      //   title: "MAS",
      //   path: "/mas",
      //   icon: CheckSquare,
      // },
    ]
  },
  {
    category: "Procurement",
    items: [
      {
        title: "Sample Management",
        path: "/samples",
        icon: Layers,
      },
      {
        title: "Purchase Requests",
        path: "/purchase-requests",
        icon: ShoppingCart,
        hidden: false,
      },
      {
        title: "Vendor Comparison",
        path: "/vendor-comparison",
        icon: ArrowRightLeft,
        hidden: false,
      },
      {
        title: "Purchase Orders",
        path: "/purchase-orders",
        icon: FileText,
      },
    ]
  },
  {
    category: "Vendor Management",
    items: [
      {
        title: "Vendors",
        path: "/vendors",
        icon: Building2,
      },
    ],
  },
  {
    category: "Delivery & Inspection",
    items: [
      {
        title: "Delivery Challans",
        path: "/challans",
        icon: Truck,
      },
      {
        title: "MER",
        path: "/mer",
        icon: FileCheck,
        hidden: true,
      },
      {
        title: "MIR",
        path: "/mir",
        icon: Eye,
        hidden: false,
      },
      {
        title: "ITR",
        path: "/itr",
        icon: Hammer,
        hidden: false,
      },
      {
        title: "Invoices",
        path: "/invoices",
        icon: Receipt,
        hidden: false,
      },
    ]
  },
  {
    category: "Billing",
    items: [
      {
        title: "Billing & Invoices",
        path: "/billing",
        icon: Receipt,
      },
    ]
  },
  {
    category: "Settings",
    items: [
      {
        title: "User Management",
        path: "/user-management",
        icon: Users,
      },
      {
        title: "Access Control",
        path: "/access-control",
        icon: Shield,
      },
    ],
  },
  {
    category: "Inventory",
    items: [
      {
        title: "Inventory",
        path: "/inventory",
        icon: Warehouse,
        hidden: true,
      },
      {
        title: "Inventory History",
        path: "/inventory-history",
        icon: History,
        hidden: true,
      },
      {
        title: "Stock Overview",
        path: "/stock-areas",
        icon: Warehouse,
        hidden: true,
      },
      {
        title: "Product Master",
        path: "/materials",
        icon: Package,
        hidden: true,
      },
      {
        title: "Stock Transfers",
        path: "/stock-transfers",
        icon: ArrowRightLeft,
        hidden: true,
      },
      {
        title: "Consumption",
        path: "/consumption",
        icon: TrendingDown,
        hidden: true,
      },
      {
        title: "Returns",
        path: "/returns",
        icon: Undo2,
        hidden: true,
      },
    ]
  },
  {
    category: "Documents",
    items: [
      {
        title: "Repository",
        path: "/documents",
        icon: FolderOpen,
        hidden: true,
      },
    ]
  },
  {
    category: "Analytics",
    items: [
      {
        title: "Reports",
        path: "/reports",
        icon: BarChart3,
        hidden: true,
      },
      {
        title: "Audit Logs",
        path: "/audit-logs",
        icon: History,
        hidden: true,
      },
    ]
  },
  // {
  //   category: "Administration",
  //   items: [
  //     {
  //       title: "User Management",
  //       path: "/users",
  //       // icon: UserCog,
  //     },
  //   ]
  // }
];
