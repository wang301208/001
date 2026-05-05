import { useAppStore, type TaskPriority, type TaskGroup, type TaskDuration } from '../stores/useAppStore';
import { useCallback } from 'react';

/**
 * 任务管理 Hook
 * 提供便捷的任务创建、更新和完成方法
 */
export function useTaskManager() {
  const { 
    addTask, 
    updateTaskProgress, 
    completeTask, 
    cancelTask, 
    removeTask,
    retryTask,
  } = useAppStore();
  
  /**
   * 创建并启动一个新任务
   * @param name 任务名称
   * @param description 任务描述（可选）
   * @param priority 优先级（默认 medium）
   * @param group 分组（默认 custom）
   * @param duration 持续时间类型（默认 short）
   * @param estimatedDurationMinutes 预计持续时间（分钟，用于长期任务）
   * @param dependencies 依赖的任务ID列表（可选）
   * @param maxRetries 最大重试次数（默认 3）
   * @param metadata 元数据（可选）
   * @returns 任务 ID
   */
  const startTask = useCallback((
    name: string, 
    description?: string,
    priority: TaskPriority = 'medium',
    group: TaskGroup = 'custom',
    duration: TaskDuration = 'short',
    estimatedDurationMinutes?: number,
    dependencies?: string[],
    maxRetries: number = 3,
    metadata?: Record<string, any>
  ) => {
    // 计算预计结束时间
    let estimatedEndTime: number | undefined;
    if (estimatedDurationMinutes) {
      estimatedEndTime = Date.now() + (estimatedDurationMinutes * 60 * 1000);
    }
    
    const taskId = addTask({
      name,
      description,
      priority,
      group,
      duration,
      estimatedEndTime,
      dependencies,
      maxRetries,
      metadata,
    });
    
    return taskId;
  }, [addTask]);
  
  /**
   * 更新任务进度
   * @param taskId 任务 ID
   * @param progress 进度百分比 (0-100)
   */
  const updateProgress = useCallback((taskId: string, progress: number) => {
    updateTaskProgress(taskId, progress);
  }, [updateTaskProgress]);
  
  /**
   * 完成任务
   * @param taskId 任务 ID
   */
  const finishTask = useCallback((taskId: string) => {
    completeTask(taskId);
  }, [completeTask]);
  
  /**
   * 任务失败
   * @param taskId 任务 ID
   * @param error 错误信息
   */
  const failTask = useCallback((taskId: string, error: string) => {
    completeTask(taskId, error);
  }, [completeTask]);
  
  /**
   * 取消任务
   * @param taskId 任务 ID
   */
  const cancelRunningTask = useCallback((taskId: string) => {
    cancelTask(taskId);
  }, [cancelTask]);
  
  /**
   * 移除任务（从列表中删除）
   * @param taskId 任务 ID
   */
  const deleteTask = useCallback((taskId: string) => {
    removeTask(taskId);
  }, [removeTask]);
  
  /**
   * 重试失败的任务
   * @param taskId 任务 ID
   * @returns 新任务 ID
   */
  const retryFailedTask = useCallback((taskId: string) => {
    return retryTask(taskId);
  }, [retryTask]);
  
  return {
    startTask,
    updateProgress,
    finishTask,
    failTask,
    cancelRunningTask,
    deleteTask,
    retryFailedTask,
  };
}

/**
 * 异步任务执行辅助函数
 * 自动处理任务的开始、进度更新和完成
 * 
 * @example
 * ```typescript
 * const { executeAsyncTask } = useTaskManager();
 * 
 * await executeAsyncTask(
 *   '数据处理',
 *   '正在处理大量数据...',
 *   async (updateProgress) => {
 *     // 模拟异步操作
 *     for (let i = 0; i <= 100; i += 10) {
 *       await new Promise(resolve => setTimeout(resolve, 100));
 *       updateProgress(i);
 *     }
 *   }
 * );
 * ```
 */
export function useAsyncTaskExecutor() {
  const { startTask, updateProgress, finishTask, failTask } = useTaskManager();
  
  const executeAsyncTask = useCallback(
    async <T>(
      name: string,
      description: string,
      taskFn: (updateProgress: (progress: number) => void) => Promise<T>,
      priority?: TaskPriority,
      group?: TaskGroup,
      duration?: TaskDuration,
      metadata?: Record<string, any>
    ): Promise<T> => {
      const taskId = startTask(name, description, priority, group, duration, undefined, undefined, 3, metadata);
      
      try {
        const result = await taskFn((progress) => {
          updateProgress(taskId, progress);
        });
        
        finishTask(taskId);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        failTask(taskId, errorMessage);
        throw error;
      }
    },
    [startTask, updateProgress, finishTask, failTask]
  );
  
  return { executeAsyncTask };
}
