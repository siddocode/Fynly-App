import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeRouter } from '../hooks/useSafeRouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import {
  X,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  FileText,
  Upload,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from 'lucide-react-native';
import { api, formatPaiseToRupees } from '../lib/api';
import { useTheme, Theme } from '../lib/theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { FinancialAccount, StatementPreviewSummary, StatementPreviewRow } from '../types';
import { sendLocalOSNotification } from '../lib/notificationService';

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
  const router = useSafeRouter();
  const queryClient = useQueryClient();
  const scrollViewRef = useRef<ScrollView>(null);
  const { theme } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [csvContent, setCsvContent] = useState<string>('');
  const [selectedBankPreset, setSelectedBankPreset] = useState<string>('');
  const [previewSummary, setPreviewSummary] = useState<StatementPreviewSummary | null>(null);
  const [previewRows, setPreviewRows] = useState<StatementPreviewRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ imported: number; duplicatesSkipped: number } | null>(null);
  const [showUpiExplanation, setShowUpiExplanation] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string | null>(null);

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

  // Pick Document from device
  const handlePickDocument = async () => {
    try {
      setErrorMessage(null);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setFileName(file.name);
        let content = '';

        if (Platform.OS === 'web' && (file as any).file) {
          content = await (file as any).file.text();
        } else if (file.uri) {
          const res = await fetch(file.uri);
          content = await res.text();
        }

        if (content) {
          setCsvContent(content);
          setSelectedBankPreset('CUSTOM');
          setPreviewSummary(null);
          setPreviewRows([]);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to select CSV file');
    }
  };

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: () => {
      setErrorMessage(null);
      if (!selectedAccountId) {
        throw new Error('Please select an account first');
      }
      if (!csvContent.trim()) {
        throw new Error('Please select a CSV file or paste statement text');
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
    onSuccess: async (data) => {
      setSuccessInfo({
        imported: data.importedCount,
        duplicatesSkipped: data.skippedCount,
      });
      sendLocalOSNotification(
        'Statement Import Complete',
        `Successfully imported ${data.importedCount} transactions (${data.skippedCount} duplicates skipped).`
      );
      // Invalidate all relevant caches for real-time visibility
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['budgets'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['insights'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['me'] }),
      ]);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to import transactions');
    },
  });

  const loadPreset = (presetCsv: string, name: string) => {
    setCsvContent(presetCsv);
    setSelectedBankPreset(name);
    setFileName(`Sample_${name}_Statement.csv`);
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
                <Text style={styles.helperText}>HDFC, ICICI, SBI, Axis, etc.</Text>
              </View>

              {/* Upload File Card */}
              <TouchableOpacity
                style={styles.uploadCard}
                onPress={handlePickDocument}
              >
                <UploadCloud size={28} color={theme.colors.primary} />
                <View style={styles.uploadCardTextCol}>
                  <Text style={styles.uploadCardTitle}>
                    {fileName ? fileName : 'Choose .CSV File from Device'}
                  </Text>
                  <Text style={styles.uploadCardSubtext}>
                    {fileName
                      ? 'File loaded! Tap to change file.'
                      : 'Tap to select statement downloaded from NetBanking'}
                  </Text>
                </View>
                <View style={styles.uploadBtnBadge}>
                  <Text style={styles.uploadBtnBadgeText}>Browse</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.orDividerRow}>
                <View style={styles.orDividerLine} />
                <Text style={styles.orDividerText}>or paste CSV rows manually</Text>
                <View style={styles.orDividerLine} />
              </View>

              <TextInput
                style={styles.csvInput}
                multiline
                numberOfLines={6}
                placeholder="Paste statement text here (Date, Description, Debit/Credit, Amount)..."
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

              {/* Sample Demo Templates (Clearly marked optional) */}
              <View style={styles.sampleSection}>
                <Text style={styles.sampleLabel}>Test with Demo Template (Optional):</Text>
                <View style={styles.presetRow}>
                  <TouchableOpacity
                    style={[
                      styles.presetBtn,
                      selectedBankPreset === 'HDFC' && styles.presetBtnActive,
                    ]}
                    onPress={() => loadPreset(SAMPLE_HDFC_CSV, 'HDFC')}
                  >
                    <FileText size={12} color={selectedBankPreset === 'HDFC' ? theme.colors.primary : theme.colors.textMuted} />
                    <Text style={[styles.presetText, selectedBankPreset === 'HDFC' && styles.presetTextActive]}>
                      HDFC Demo
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.presetBtn,
                      selectedBankPreset === 'ICICI' && styles.presetBtnActive,
                    ]}
                    onPress={() => loadPreset(SAMPLE_ICICI_CSV, 'ICICI')}
                  >
                    <FileText size={12} color={selectedBankPreset === 'ICICI' ? theme.colors.primary : theme.colors.textMuted} />
                    <Text style={[styles.presetText, selectedBankPreset === 'ICICI' && styles.presetTextActive]}>
                      ICICI Demo
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.presetBtn,
                      selectedBankPreset === 'SBI' && styles.presetBtnActive,
                    ]}
                    onPress={() => loadPreset(SAMPLE_SBI_CSV, 'SBI')}
                  >
                    <FileText size={12} color={selectedBankPreset === 'SBI' ? theme.colors.primary : theme.colors.textMuted} />
                    <Text style={[styles.presetText, selectedBankPreset === 'SBI' && styles.presetTextActive]}>
                      SBI Demo
                    </Text>
                  </TouchableOpacity>

                  {csvContent.length > 0 && (
                    <TouchableOpacity
                      style={styles.presetBtn}
                      onPress={() => {
                        setCsvContent('');
                        setFileName(null);
                        setSelectedBankPreset('');
                        setPreviewSummary(null);
                        setPreviewRows([]);
                      }}
                    >
                      <Text style={[styles.presetText, { color: theme.colors.alertRed }]}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* UPI & Bank Sync FAQ Card */}
              <TouchableOpacity
                style={styles.upiInfoCard}
                onPress={() => setShowUpiExplanation(!showUpiExplanation)}
                activeOpacity={0.8}
              >
                <View style={styles.upiInfoHeaderRow}>
                  <View style={styles.upiInfoTitleRow}>
                    <Info size={16} color={theme.colors.info} />
                    <Text style={styles.upiInfoTitle}>Can Fynly connect directly with UPI apps?</Text>
                  </View>
                  {showUpiExplanation ? (
                    <ChevronUp size={16} color={theme.colors.textMuted} />
                  ) : (
                    <ChevronDown size={16} color={theme.colors.textMuted} />
                  )}
                </View>

                {showUpiExplanation && (
                  <View style={styles.upiInfoBody}>
                    <Text style={styles.upiInfoText}>
                      • <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>Security & Regulations:</Text> In India, NPCI and RBI strictly prohibit third-party apps from silently accessing Google Pay, PhonePe, or Paytm payment databases.
                    </Text>
                    <Text style={styles.upiInfoText}>
                      • <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>Official Automated Route:</Text> Under RBI guidelines, authorized automated sync is handled via the <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>RBI Account Aggregator (AA) framework</Text> (such as Setu, Finvu, OneMoney) with bank-verified OTP consent.
                    </Text>
                    <Text style={styles.upiInfoText}>
                      • <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>Why CSV is 100% Private:</Text> Downloading your statement from your bank takes under 15 seconds, keeps credentials strictly confidential, and prevents duplicate transaction entries automatically!
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <Button
                title={previewMutation.isPending ? 'Analyzing Statement...' : 'Preview Statement'}
                onPress={() => {
                  if (!previewMutation.isPending && !importMutation.isPending) {
                    previewMutation.mutate();
                  }
                }}
                variant="secondary"
                disabled={!selectedAccountId || !csvContent.trim() || previewMutation.isPending || importMutation.isPending}
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

                <Button
                  title={
                    importMutation.isPending
                      ? 'Importing...'
                      : `Confirm & Import ${previewSummary.newRowsCount} Transactions`
                  }
                  onPress={() => {
                    if (!importMutation.isPending && !previewMutation.isPending) {
                      importMutation.mutate();
                    }
                  }}
                  disabled={previewSummary.newRowsCount === 0 || importMutation.isPending || previewMutation.isPending}
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

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    closeBtn: {
      padding: 6,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    scrollContent: {
      padding: 16,
      gap: 16,
    },
    section: {
      gap: 10,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    helperText: {
      fontSize: 12,
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
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      marginRight: 8,
    },
    accountChipSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryBg,
    },
    accountChipText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    accountChipTextSelected: {
      color: theme.colors.primary,
      fontWeight: '700',
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
      borderRadius: 8,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    presetBtnActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryBg,
    },
    presetText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    presetTextActive: {
      color: theme.colors.primary,
      fontWeight: '600',
    },
    csvInput: {
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      color: theme.colors.textPrimary,
      padding: 14,
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
      gap: 8,
      backgroundColor: theme.colors.dangerBg,
      borderColor: theme.colors.danger,
      padding: 14,
    },
    errorText: {
      fontSize: 12,
      color: theme.colors.danger,
      flex: 1,
    },
    warningCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.warningBg,
      borderColor: theme.colors.warning,
      padding: 14,
    },
    warningText: {
      fontSize: 12,
      color: theme.colors.warning,
      flex: 1,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 8,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 14,
    },
    statLabel: {
      fontSize: 10,
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginTop: 4,
    },
    flowRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    flowText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    previewList: {
      gap: 6,
    },
    rowCard: {
      padding: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    rowCardDuplicate: {
      opacity: 0.55,
      backgroundColor: theme.colors.surfaceAlt,
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
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      marginTop: 2,
    },
    rowRight: {
      alignItems: 'flex-end',
      gap: 4,
    },
    rowAmount: {
      fontSize: 14,
      fontWeight: '700',
    },
    rowBottom: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
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
      marginTop: 14,
    },
    successCard: {
      alignItems: 'center',
      paddingVertical: 36,
      gap: 14,
    },
    successTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    successMessage: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 16,
      lineHeight: 20,
    },
    successActions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
      width: '100%',
    },
    uploadCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1.5,
      borderColor: theme.colors.primary,
      borderStyle: 'dashed',
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      gap: 12,
    },
    uploadCardTextCol: {
      flex: 1,
    },
    uploadCardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    uploadCardSubtext: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    uploadBtnBadge: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    uploadBtnBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textInverse,
    },
    orDividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 8,
    },
    orDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },
    orDividerText: {
      fontSize: 11,
      color: theme.colors.textMuted,
      marginHorizontal: 8,
    },
    sampleSection: {
      marginTop: 14,
      marginBottom: 8,
    },
    sampleLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginBottom: 6,
      fontWeight: '600',
    },
    upiInfoCard: {
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      padding: 14,
      marginVertical: 14,
    },
    upiInfoHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    upiInfoTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    upiInfoTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    upiInfoBody: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      gap: 8,
    },
    upiInfoText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
  });
