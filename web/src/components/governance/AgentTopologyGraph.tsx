import { Card, Title, Text, Badge, Group, Stack, ThemeIcon } from '@mantine/core';
import * as d3 from 'd3';
import { hierarchy } from 'd3-hierarchy';
import { useEffect, useRef } from 'react';
import type { AgentNode } from '../../types';
import { IconUsers } from '@tabler/icons-react';

interface AgentTopologyGraphProps {
  agents: AgentNode[];
}

export function AgentTopologyGraph({ agents }: AgentTopologyGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  
  useEffect(() => {
    if (!svgRef.current || agents.length === 0) return;
    
    // 清除之前的图表
    d3.select(svgRef.current).selectAll('*').remove();
    
    const width = 800;
    const height = 600;
    
    // 创建 SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);
    
    // 转换数据为 D3 层次结构
    const root = hierarchy({ name: 'Root', children: agents } as any);
    
    // 创建树状布局
    const treeLayout = d3.tree<AgentNode>()
      .size([width - 100, height - 100]);
    
    treeLayout(root);
    
    // 创建连线
    svg.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkVertical()
        .x((d: any) => d.x)
        .y((d: any) => d.y) as any)
      .attr('fill', 'none')
      .attr('stroke', '#dee2e6')
      .attr('stroke-width', 2);
    
    // 创建节点
    const nodes = svg.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    
    // 添加圆形节点
    nodes.append('circle')
      .attr('r', 24)
      .attr('fill', (d: any) => {
        const status = d.data.status;
        switch (status) {
          case 'active': return '#40c057';
          case 'inactive': return '#868e96';
          case 'frozen': return '#fa5252';
          default: return '#fd7e14';
        }
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 3)
      .style('filter', 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))');
    
    // 添加标签
    nodes.append('text')
      .attr('dy', 40)
      .attr('text-anchor', 'middle')
      .text((d: any) => d.data.name || d.data.role)
      .attr('font-size', '13px')
      .attr('font-weight', '600')
      .attr('fill', '#495057');
    
    // 添加工具提示
    nodes.append('title')
      .text((d: any) => {
        const data = d.data;
        return `${data.name || data.role}\n角色: ${data.role}\n状态: ${data.status}`;
      });
    
  }, [agents]);
  
  if (agents.length === 0) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack align="center" gap="md" py="xl">
          <ThemeIcon size="xl" variant="light" color="gray">
            <IconUsers size={32} />
          </ThemeIcon>
          <Text c="dimmed">暂无代理数据</Text>
        </Stack>
      </Card>
    );
  }
  
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={3}>代理组织图</Title>
        <Badge variant="light" color="blue">{agents.length} 个代理</Badge>
      </Group>
      
      <div style={{ overflow: 'auto', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
        <svg ref={svgRef}></svg>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <Text size="sm" fw={600} mb="xs">图例：</Text>
        <Group gap="xl">
          <Group gap="xs">
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#40c057' }}></div>
            <Text size="sm">活跃</Text>
          </Group>
          <Group gap="xs">
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#868e96' }}></div>
            <Text size="sm">非活跃</Text>
          </Group>
          <Group gap="xs">
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#fa5252' }}></div>
            <Text size="sm">冻结</Text>
          </Group>
        </Group>
      </div>
    </Card>
  );
}
