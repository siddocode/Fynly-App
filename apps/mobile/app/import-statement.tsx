import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Sparkles,
} from 'lucide-react-native';
import { api, formatPaiseToRupees } from '../lib/api';
import { theme } from '../lib/theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { FinancialAccount, StatementPreviewSummary, StatementPreviewRow } from '../types';

const SAMPLE_HDFC_CSV = `Date,Narration,Chq/Ref Number,Withdrawal Amount,Deposit Amount,Closing Balance
2026-10-25,UPI-SWIGGY-1029485@okaxis,UPI29485,349.00,,45210.00
2026-10-24,UPI-ZEPTO-GROCERY-88392@icici,UPI88392,620.50,,45559.00
2026-10-23,SALARY CREDITED OCT 2026,SAL88392,,85000.00,46179.50
2026-10-22,UBER INDIA SYSTEMS PVT LTD,UBR9284,240.00,,38820.50
2026-10-20,NETFLIX ENTERTAINMENT,NFLX992,649.00,,39060.50`;

const SAMPLE_ICICI_CSV = `Transaction Date,Transaction Remarks,Reference Number,Debit,Credit,Balance
24/10/2026,UPI-ZOMATO-ORDER-9482,TXN48201,450.00,,32400.00
23/10/2026,AMAZON PAY INDIA PVT LTD,TXN48202,1299.00,,32850.00
21/10/2026,REFUND FROM FLIPKART,TXN48203,,899.00,34149.00
20/10/2026,BESCOM ELECTRICITY BILL,TXN48204,1850.00,,33250.00
18/10/2026,BLINKIT QUICK COMMERCE,TXN48205,385.00,,35100.00`;

const SAMPLE_SBI_CSV = `Txn Date,Description,Ref No.,Debit,Credit,Balance
25-10-2026,HPCL PETROL PUMP BANGALORE,SBI9921,1500.00,,28900.00
24-10-2026,APOLLO PHARMACY HEALTHCARE,SBI9922,420.00,,30400.00
22-10-2026,DIVIDEND CREDITED TATA MOTORS,SBI9923,,350.00,30820.00
20-10-2026,AIRTEL BROADBAND BILLPAY,SBI9924,943.00,,30470.00
19-10-2026,STARBUCKS COFFEE INDIRANAGAR,SBI9925,380.00,,31413.00`;

export default function ImportStatementScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [csvContent, setCsvContent] = useState<string>(SAMPLE_HDFC_CSV);
  const [selectedBankPreset, setSelectedBankPreset] = useState<string>('HDFC');
  const [previewSummary, setPreviewSummary] = useState<StatementPreviewSummary | null>(null);
  const [previewRows, setPreviewRows] = useState<StatementPreviewRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ imported: number; duplicatesSkipped: number } | null>(null);

  // Fetch user accounts
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: api.getAccounts,
  });

  // Auto-select first account if none selected
  React.useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: () => {
      setErrorMessage(null);
      if (!selectedAccountId) {
        throw new Error('Please select an account first');
      }
      if (!csvContent.trim()) {
        throw new Error('Please enter or paste CSV content');
      }
      return api.previewStatement({
        accountId: selectedAccountId,
        csvContent: csvContent.trim(),
      });
    },
    onSuccess: (data) => {
      setPreviewSummary(data.summary);
      setPreviewRows(data.rows);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to parse statement preview');
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: () => {
      setErrorMessage(null);
      if (!selectedAccountId) {
        throw new Error('Please select an account first');
      }
      if (previewRows.length === 0) {
        throw new Error('No preview transactions found to import');
      }

      // Filter out duplicate rows
      const toImport = previewRows
        .filter((r) => !r.isDuplicate)
        .map((r) => ({
          date: r.date,
          description: r.description,
          merchantName: r.merchantName,
          amountPaise: r.amountPaise,
          type: r.type,
          categoryId: r.categoryId,
          referenceNumber: r.referenceNumber,
        }));

      return api.importStatement({
        accountId: selectedAccountId,
        transactions: toImport,
      });
    },
    onSuccess: (data) => {
      setSuccessInfo({
        imported: data.importedCount,
        duplicatesSkipped: data.skippedCount,
      });
      // Invalidate relevant caches
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to import transactions');
    },
  });

  const loadPreset = (presetCsv: string, name: string) => {
    setCsvContent(presetCsv);
    setSelectedBankPreset(name);
    setPreviewSummary(null);
    setPreviewRows([]);
    setErrorMessage(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import Statement</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Success View */}
        {successInfo ? (
          <Card style={styles.successCard} variant="default">
            <CheckCircle2 size={56} color={theme.colors.income} />
            <Text style={styles.successTitle}>Import Completed!</Text>
            <Text style={styles.successMessage}>
              Successfully imported{' '}
              <Text style={{ fontWeight: 'bold', color: theme.colors.textPrimary }}>
                {successInfo.imported}
              </Text>{' '}
              new transactions.
              {successInfo.duplicatesSkipped > 0 &&
                ` (${successInfo.duplicatesSkipped} duplicates skipped)`}
            </Text>
            <View style={styles.successActions}>
              <Button
                title="View in Activity"
                onPress={() => {
                  router.dismiss();
                  router.push('/activity');
                }}
                style={{ flex: 1 }}
              />
              <Button
                title="Done"
                variant="secondary"
                onPress={() => router.dismiss()}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ) : (
          <>
            {/* Step 1: Select Account */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>1. Destination Account</Text>
              {accountsLoading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : accounts.length === 0 ? (
                <Card style={styles.warningCard} variant="subtle">
                  <AlertTriangle size={18} color={theme.colors.alertAmber} />
                  <Text style={styles.warningText}>
                    No account found. Please create an account in your Profile first.
                  </Text>
                </Card>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountList}>
                  {accounts.map((acc: FinancialAccount) => {
                    const isSelected = acc.id === selectedAccountId;
                    return (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() => {
                          setSelectedAccountId(acc.id);
                          setPreviewSummary(null);
                          setPreviewRows([]);
                        }}
                        style={[
                          styles.accountChip,
                          isSelected && styles.accountChipSelected,
                        ]}
                      >
                        <CreditCard
                          size={14}
                          color={isSelected ? theme.colors.primary : theme.colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.accountChipText,
                            isSelected && styles.accountChipTextSelected,
                          ]}
                        >
                          {acc.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* Step 2: Presets & CSV Input */}
            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionLabel}>2. Bank Statement CSV</Text>
                <Text style={styles.helperText}>Auto-detects HDFC, ICICI, SBI</Text>
              </View>

              {/* Sample Preset Chips */}
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={[
                    styles.presetBtn,
                    selectedBankPreset === 'HDFC' && styles.presetBtnActive,
                  ]}
                  onPress={() => loadPreset(SAMPLE_HDFC_CSV, 'HDFC')}
                >
                  <Sparkles size={12} color={selectedBankPreset === 'HDFC' ? theme.colors.primary : theme.colors.textMuted} />
                  <Text style={[styles.presetText, selectedBankPreset === 'HDFC' && styles.presetTextActive]}>
                    HDFC Sample
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.presetBtn,
                    selectedBankPreset === 'ICICI' && styles.presetBtnActive,
                  ]}
                  onPress={() => loadPreset(SAMPLE_ICICI_CSV, 'ICICI')}
                >
                  <Sparkles size={12} color={selectedBankPreset === 'ICICI' ? theme.colors.primary : theme.colors.textMuted} />
                  <Text style={[styles.presetText, selectedBankPreset === 'ICICI' && styles.presetTextActive]}>
                    ICICI Sample
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.presetBtn,
                    selectedBankPreset === 'SBI' && styles.presetBtnActive,
                  ]}
                  onPress={() => loadPreset(SAMPLE_SBI_CSV, 'SBI')}
                >
                  <Sparkles size={12} color={selectedBankPreset === 'SBI' ? theme.colors.primary : theme.colors.textMuted} />
                  <Text style={[styles.presetText, selectedBankPreset === 'SBI' && styles.presetTextActive]}>
                    SBI Sample
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetBtn}
                  onPress={() => {
                    setCsvContent('');
                    setSelectedBankPreset('CUSTOM');
                    setPreviewSummary(null);
                    setPreviewRows([]);
                  }}
                >
                  <Text style={styles.presetText}>Clear</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.csvInput}
                multiline
                numberOfLines={7}
                placeholder="Paste CSV rows here (Date, Description, Debit/Credit, Amount)..."
                placeholderTextColor={theme.colors.textMuted}
                value={csvContent}
                onChangeText={(text) => {
                  setCsvContent(text);
                  setPreviewSummary(null);
                  setPreviewRows([]);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Button
                title={previewMutation.isPending ? 'Analyzing Statement...' : 'Preview Statement'}
                onPress={() => previewMutation.mutate()}
                variant="secondary"
                disabled={!selectedAccountId || !csvContent.trim() || previewMutation.isPending}
                icon={
                  previewMutation.isPending ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <UploadCloud size={16} color={theme.colors.primary} />
                  )
                }
                style={styles.previewBtn}
              />
            </View>

            {/* Error Message */}
            {errorMessage && (
              <Card style={styles.errorCard} variant="subtle">
                <AlertTriangle size={18} color={theme.colors.alertRed} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </Card>
            )}

            {/* Step 3: Reconciliation & Preview */}
            {previewSummary && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>3. Reconciliation Summary</Text>

                {/* Summary Metrics */}
                <View style={styles.statsGrid}>
                  <Card style={styles.statCard} variant="subtle">
                    <Text style={styles.statLabel}>Total Rows</Text>
                    <Text style={styles.statValue}>{previewSummary.totalRows}</Text>
                  </Card>
                  <Card style={styles.statCard} variant="subtle">
                    <Text style={styles.statLabel}>New Entries</Text>
                    <Text style={[styles.statValue, { color: theme.colors.income }]}>
                      {previewSummary.newRowsCount}
                    </Text>
                  </Card>
                  <Card style={styles.statCard} variant="subtle">
                    <Text style={styles.statLabel}>Duplicates</Text>
                    <Text
                      style={[
                        styles.statValue,
                        {
                          color:
                            previewSummary.duplicateRowsCount > 0
                              ? theme.colors.alertAmber
                              : theme.colors.textMuted,
                        },
                      ]}
                    >
                      {previewSummary.duplicateRowsCount}
                    </Text>
                  </Card>
                </View>

                <View style={styles.flowRow}>
                  <Text style={styles.flowText}>
                    Total Outflow:{' '}
                    <Text style={{ color: theme.colors.expense, fontWeight: 'bold' }}>
                      {formatPaiseToRupees(previewSummary.totalDebitPaise)}
                    </Text>
                  </Text>
                  <Text style={styles.flowText}>
                    Total Inflow:{' '}
                    <Text style={{ color: theme.colors.income, fontWeight: 'bold' }}>
                      {formatPaiseToRupees(previewSummary.totalCreditPaise)}
                    </Text>
                  </Text>
                </View>

                {/* Preview Items */}
                <Text style={[styles.sectionLabel, { marginTop: theme.spacing.md }]}>
                  Transaction List ({previewRows.length})
                </Text>

                <View style={styles.previewList}>
                  {previewRows.map((row: StatementPreviewRow, index: number) => {
                    const isExpense = row.type === 'EXPENSE';
                    return (
                      <Card
                        key={index}
                        style={[
                          styles.rowCard,
                          row.isDuplicate && styles.rowCardDuplicate,
                        ]}
                        variant="subtle"
                      >
                        <View style={styles.rowTop}>
                          <View style={styles.rowMain}>
                            <Text style={styles.rowDate}>{row.rawDate}</Text>
                            <Text style={styles.rowMerchant} numberOfLines={1}>
                              {row.merchantName || row.description}
                            </Text>
                          </View>
                          <View style={styles.rowRight}>
                            <Text
                              style={[
                                styles.rowAmount,
                                {
                                  color: isExpense
                                    ? theme.colors.expense
                                    : theme.colors.income,
                                },
                              ]}
                            >
                              {isExpense ? '-' : '+'}
                              {formatPaiseToRupees(row.amountPaise)}
                            </Text>
                            {row.isDuplicate ? (
                              <Badge label="Duplicate" variant="warning" />
                            ) : (
                              <Badge label="Ready" variant="success" />
                            )}
                          </View>
                        </View>
                        <View style={styles.rowBottom}>
                          <Text style={styles.rowDesc} numberOfLines={1}>
                            {row.description}
                          </Text>
                          {row.referenceNumber ? (
                            <Text style={styles.categoryBadge}>
                              Ref: {row.referenceNumber}
                            </Text>
                          ) : null}
                        </View>
                      </Card>
                    );
                  })}
                </View>

                {/* Confirm Import Button */}
                <Button
                  title={
                    importMutation.isPending
                      ? 'Importing...'
                      : `Confirm & Import ${previewSummary.newRowsCount} Transactions`
                  }
                  onPress={() => importMutation.mutate()}
                  disabled={previewSummary.newRowsCount === 0 || importMutation.isPending}
                  icon={
                    importMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <CheckCircle2 size={18} color="#fff" />
                    )
                  }
                  style={styles.importConfirmBtn}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.surfaceBorder,
  },
  closeBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helperText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  accountList: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    backgroundColor: theme.colors.surface,
    marginRight: 8,
  },
  accountChipSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}15`,
  },
  accountChipText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  accountChipTextSelected: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  presetBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}15`,
  },
  presetText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  presetTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  csvInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    color: theme.colors.textPrimary,
    padding: theme.spacing.md,
    fontSize: 12,
    fontFamily: 'monospace',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  previewBtn: {
    marginTop: 4,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: `${theme.colors.alertRed}15`,
    borderColor: theme.colors.alertRed,
    padding: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.alertRed,
    flex: 1,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: `${theme.colors.alertAmber}15`,
    borderColor: theme.colors.alertAmber,
    padding: theme.spacing.md,
  },
  warningText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.alertAmber,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    marginTop: 4,
  },
  flowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  flowText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  previewList: {
    gap: theme.spacing.xs,
  },
  rowCard: {
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  rowCardDuplicate: {
    opacity: 0.55,
    backgroundColor: theme.colors.surfaceSubtle,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rowMain: {
    flex: 1,
  },
  rowDate: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  rowMerchant: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rowAmount: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
  },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: `${theme.colors.surfaceBorder}40`,
  },
  rowDesc: {
    fontSize: 11,
    color: theme.colors.textMuted,
    flex: 1,
  },
  categoryBadge: {
    fontSize: 10,
    color: theme.colors.primary,
    marginLeft: 6,
  },
  importConfirmBtn: {
    marginTop: theme.spacing.md,
  },
  successCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing['3xl'],
    gap: theme.spacing.md,
  },
  successTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
  },
  successMessage: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
    lineHeight: 20,
  },
  successActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
    width: '100%',
  },
});
