import { Component, OnInit, inject, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UmlDiagram } from '../../models/uml.models';
import { UmlAuditService, AuditReport, AuditRecommendation } from '../../services/uml-audit.service';

@Component({
  selector: 'app-uml-audit-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './uml-audit-modal.component.html',
  styleUrl: './uml-audit-modal.component.css'
})
export class UmlAuditModalComponent implements OnInit {
  private auditService = inject(UmlAuditService);

  // Inputs
  diagram = input.required<UmlDiagram>();

  // Eventos de salida
  close = output<void>();
  applyNormalization = output<UmlDiagram>();

  // Estados reactivos
  auditReport = signal<AuditReport | null>(null);
  
  // Conjunto de IDs de recomendaciones seleccionadas por casilleros (Checkboxes)
  checkedRecIds = signal<Set<string>>(new Set());

  // Diagrama propuesto reactivo que se recalcula al marcar/desmarcar casilleros
  proposedDiagram = computed(() => {
    const orig = this.diagram();
    const checked = this.checkedRecIds();
    return this.auditService.applyFixes(orig, checked);
  });

  // Estadísticas del diagrama propuesto
  proposedStats = computed(() => {
    const orig = this.diagram();
    const prop = this.proposedDiagram();
    
    const newClasses = Math.max(0, prop.classes.length - orig.classes.length);
    const origAttrs = orig.classes.reduce((sum, c) => sum + c.attributes.length, 0);
    const propAttrs = prop.classes.reduce((sum, c) => sum + c.attributes.length, 0);
    const newAttrs = Math.max(0, propAttrs - origAttrs);
    const newRelations = Math.max(0, prop.relations.length - orig.relations.length);

    return {
      newClasses,
      newAttrs,
      newRelations,
      totalClasses: prop.classes.length,
      totalRelations: prop.relations.length
    };
  });

  ngOnInit(): void {
    this.ejecutarAuditoria();
  }

  ejecutarAuditoria(): void {
    const report = this.auditService.auditDiagram(this.diagram());
    this.auditReport.set(report);
    // Por defecto, marcar todas las casillas para ofrecer la mejor optimización inicial
    const initialSet = new Set<string>(report.recommendations.map(r => r.id));
    this.checkedRecIds.set(initialSet);
  }

  toggleCheck(recId: string): void {
    this.checkedRecIds.update(set => {
      const newSet = new Set(set);
      if (newSet.has(recId)) {
        newSet.delete(recId);
      } else {
        newSet.add(recId);
      }
      return newSet;
    });
  }

  marcarTodas(): void {
    const rep = this.auditReport();
    if (!rep) return;
    this.checkedRecIds.set(new Set(rep.recommendations.map(r => r.id)));
  }

  desmarcarTodas(): void {
    this.checkedRecIds.set(new Set());
  }

  confirmarYAplicarAlLienzo(): void {
    const prop = this.proposedDiagram();
    if (!prop) return;
    this.applyNormalization.emit(prop);
    this.close.emit();
  }

  cerrar(): void {
    this.close.emit();
  }
}
