import { useParams } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { AgentFlowChart } from '../components/AgentFlowChart';
import { TaskDag } from '../components/TaskDag';
import { MetricsChart } from '../components/MetricsChart';
import { DecisionLog } from '../components/DecisionLog';
import { EventLog } from '../components/EventLog';
import { useSSE } from '../hooks/useSSE';

export function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { events, state, isConnected } = useSSE(id);
  const activeMission = id
    ? state.missions.find(m => m.id === id)
    : state.missions[0];

  return (
    <div className="flex-1 flex flex-col">
      {/* CONSTRAINT: 連線狀態指示器放在頁面頂部，方便使用者快速確認 SSE 狀態 */}
      <div className="flex items-center gap-2 px-4 pt-2">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: isConnected ? '#3d6b5a' : '#cc3333',
            boxShadow: isConnected ? '0 0 4px #3d6b5a' : '0 0 4px #cc3333',
          }}
        />
        <span className="text-[10px] text-text-dim uppercase tracking-wider">
          {isConnected ? 'STREAM ACTIVE' : 'DISCONNECTED'}
        </span>
      </div>

      <div className="grid grid-cols-[16rem_1fr] gap-4 p-4 flex-1">
        <Sidebar
          mission={activeMission}
          sessions={state.sessions}
        />

        <main className="flex flex-col gap-4 min-w-0">
          <AgentFlowChart
            mission={activeMission}
            tasks={state.tasks}
            sessions={state.sessions}
            decisions={state.decisions}
          />
          <TaskDag tasks={state.tasks} />
          <MetricsChart
            tokenHistory={state.tokenHistory}
            sessions={state.sessions}
          />
          <DecisionLog decisions={state.decisions} />
          <EventLog events={events} />
        </main>
      </div>
    </div>
  );
}
