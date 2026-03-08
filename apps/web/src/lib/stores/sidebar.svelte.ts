interface RecentProject {
  id: string;
  name: string;
}

let collapsed = $state(false);
let activeSection = $state('');
let recentProjects = $state<RecentProject[]>([]);

export function getSidebarStore() {
  return {
    get collapsed() {
      return collapsed;
    },
    set collapsed(v: boolean) {
      collapsed = v;
    },
    get activeSection() {
      return activeSection;
    },
    set activeSection(v: string) {
      activeSection = v;
    },
    get recentProjects() {
      return recentProjects;
    },
    set recentProjects(v: RecentProject[]) {
      recentProjects = v;
    },
    toggle() {
      collapsed = !collapsed;
    },
  };
}
