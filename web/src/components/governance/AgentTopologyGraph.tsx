import { useEffect, useRef } from 'react';
import { Card, Title, Text, Badge } from '@mantine/core';
import * as d3 from 'd3';
import type { AgentNode } from '../types';

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
    const hierarchyData = {
      name: '根节点',
      children: agents,
    };
    
    const root = d3.hierarchy(hierarchyData);
    
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
        .y((d: any) => d.y)
      )
      .attr('fill', 'none')
      .attr('stroke', '#ccc')
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
      .attr('r', 20)
      .attr('fill', (d: any) => {
        const status = d.data.status;
        switch (status) {
          case 'active': return '#20C997';
          case 'inactive': return '#868e96';
          case 'frozen': return '#E64980';
          default: return '#FF5A36';
        }
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);
    
    // 添加标签
    nodes.append('text')
      .attr('dy', 35)
      .attr('text-anchor', 'middle')
      .text((d: any) => d.data.name || d.data.role)
      .attr('font-size', '12px')
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
        <Text c="dimmed">暂无代理数据</Text>
      </Card>
    );
  }
  
  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Title order={3} mb="md">代理组织图</Title>
      <div style={{ overflow: 'auto' }}>
        <svg ref={svgRef}></svg>
      </div>
      <div style={{ marginTop: '16px' }}>
        <Text size="sm" fw={500} mb="xs">图例：</Text>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#20C997' }}></div>
            <Text size="sm">活跃</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#868e96' }}></div>
            <Text size="sm">非活跃</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#E64980' }}></div>
            <Text size="sm">冻结</Text>
          </div>
        </div>
      </div>
    </Card>
  );
}
