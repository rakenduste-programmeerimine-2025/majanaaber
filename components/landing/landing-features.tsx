import {
  Building2,
  Users,
  MessageCircle,
  Bell,
  Shield,
  UserCheck,
  MessagesSquare,
} from "lucide-react";

const features = [
  {
    icon: Building2,
    title: "Building Management",
    description:
      "Efficiently manage buildings and apartments. Add properties, assign residents, and keep everything organized in one place.",
    forRole: "Manager",
  },
  {
    icon: Users,
    title: "Resident Management",
    description:
      "Easily assign tenants and owners to apartments, manage permissions, and keep track of all residents.",
    forRole: "Manager",
  },
  {
    icon: Bell,
    title: "Announcements",
    description:
      "Share important updates with all residents through the announcement board with push notifications.",
    forRole: "Manager",
  },
  {
    icon: MessageCircle,
    title: "Building Chat",
    description:
      "Foster community with a building-wide chat. Share images, communicate easily, and stay connected.",
    forRole: "Everyone",
  },
  {
    icon: MessagesSquare,
    title: "Private Messaging",
    description:
      "Direct peer-to-peer messaging for private conversations between residents and managers.",
    forRole: "Everyone",
  },
  {
    icon: Shield,
    title: "Secure Authentication",
    description:
      "Email and phone verification ensure secure access. Account recovery options keep your data safe.",
    forRole: "Everyone",
  },
  {
    icon: UserCheck,
    title: "Role-Based Access",
    description:
      "Different permissions for managers, owners, and tenants ensure everyone has the right level of access.",
    forRole: "Everyone",
  },
];

export function LandingFeatures() {
  return (
    <div className="w-full py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Everything you need to manage your building
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed for both building managers and residents
          </p>
        </div>

        {/* Top row - 4 cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {features.slice(0, 4).map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="flex flex-col p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground px-2 py-1 rounded-full bg-secondary">
                    {feature.forRole}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Bottom row - 3 cards centered */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:px-[12.5%]">
          {features.slice(4).map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index + 4}
                className="flex flex-col p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground px-2 py-1 rounded-full bg-secondary">
                    {feature.forRole}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
