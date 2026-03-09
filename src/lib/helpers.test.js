import { describe, it, expect } from 'vitest'; // Ajuste para 'jest' se estiver usando Jest/CRA
import { parseDocs, isPago, formatDateForInput, formatDateDisplay, isImage, isPdf } from './helpers';

describe('Helpers Unit Tests', () => {
  
  describe('parseDocs', () => {
    it('deve retornar o próprio array se a entrada já for um array', () => {
      const input = ['doc1', 'doc2'];
      expect(parseDocs(input)).toBe(input);
    });

    it('deve fazer o parse de uma string JSON válida', () => {
      const input = '["doc1", "doc2"]';
      expect(parseDocs(input)).toEqual(['doc1', 'doc2']);
    });

    it('deve retornar array vazio para JSON inválido', () => {
      expect(parseDocs('invalid json')).toEqual([]);
    });

    it('deve retornar array vazio para null ou undefined', () => {
      expect(parseDocs(null)).toEqual([]);
      expect(parseDocs(undefined)).toEqual([]);
    });
  });

  describe('isPago', () => {
    it('deve retornar true para valores que indicam pagamento', () => {
      expect(isPago(true)).toBe(true);
      expect(isPago(1)).toBe(true);
      expect(isPago('1')).toBe(true);
      expect(isPago('true')).toBe(true);
    });

    it('deve retornar false para valores que não indicam pagamento', () => {
      expect(isPago(false)).toBe(false);
      expect(isPago(0)).toBe(false);
      expect(isPago('0')).toBe(false);
      expect(isPago(null)).toBe(false);
      expect(isPago(undefined)).toBe(false);
      expect(isPago('')).toBe(false);
    });
  });

  describe('formatDateForInput', () => {
    it('deve formatar objeto Date para YYYY-MM-DD', () => {
      const date = new Date(2023, 9, 25); // Outubro (mês 9)
      expect(formatDateForInput(date)).toBe('2023-10-25');
    });

    it('deve extrair a data YYYY-MM-DD de uma string ISO', () => {
      expect(formatDateForInput('2023-10-25T15:00:00.000Z')).toBe('2023-10-25');
    });

    it('deve retornar string vazia para null ou undefined', () => {
      expect(formatDateForInput(null)).toBe('');
      expect(formatDateForInput(undefined)).toBe('');
    });
  });

  describe('formatDateDisplay', () => {
    it('deve formatar string YYYY-MM-DD para DD/MM/YYYY manualmente (evitando timezone)', () => {
      expect(formatDateDisplay('2023-10-25')).toBe('25/10/2023');
    });

    it('deve formatar string ISO usando date-fns', () => {
      // O resultado exato pode depender do timezone local do runner, mas verificamos o formato
      const result = formatDateDisplay('2023-10-25T12:00:00');
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('deve retornar travessão para datas inválidas ou vazias', () => {
      expect(formatDateDisplay(null)).toBe('—');
      expect(formatDateDisplay('')).toBe('—');
      expect(formatDateDisplay('data-invalida')).toBe('—');
    });
  });

  describe('isImage', () => {
    it('deve identificar extensões de imagem comuns', () => {
      expect(isImage('foto.jpg')).toBe(true);
      expect(isImage('foto.png')).toBe(true);
      expect(isImage('foto.jpeg')).toBe(true);
      expect(isImage('foto.webp')).toBe(true);
    });

    it('deve identificar base64 de imagem', () => {
      expect(isImage('data:image/png;base64,iVBORw0KGgo...')).toBe(true);
    });

    it('deve retornar false para outros arquivos', () => {
      expect(isImage('documento.pdf')).toBe(false);
      expect(isImage(null)).toBe(false);
    });
  });

  describe('isPdf', () => {
    it('deve identificar extensão pdf', () => {
      expect(isPdf('documento.pdf')).toBe(true);
    });

    it('deve identificar base64 de pdf', () => {
      expect(isPdf('data:application/pdf;base64,JVBERi...')).toBe(true);
    });

    it('deve retornar false para outros arquivos', () => {
      expect(isPdf('foto.jpg')).toBe(false);
    });
  });
});